// =====================================================================
// PortSwigger-style SQLi labs - extension module (self-contained).
// Adds new labs without touching the original labs 1-3 engine.
// Batch 1: UNION attacks (determine columns, find text column,
//          retrieve data, multiple values in single column).
// Each lab is a data definition + a shared UNION simulator.
// =====================================================================
(function () {
    "use strict";

    // Secret data the UNION attacks exfiltrate.
    const SECRET_USERS = [
        { username: "administrator", password: "4dm1n_un10n_p4ss" },
        { username: "carlos", password: "montoya" },
        { username: "wiener", password: "peter" }
    ];

    // Products shown by the normal (pre-injection) filter.
    const PRODUCTS = [
        { category: "Gifts", name: "Cuddly Koala" },
        { category: "Gifts", name: "Giant Grasshopper" },
        { category: "Accessories", name: "Hologram Stickers" }
    ];

    // Random marker string a lab asks you to print (find-the-text-column).
    const TEXT_MARKER = "x7Km9q";

    // ---------------------------------------------------------------
    // Lab definitions. `columns` = real column count of the products
    // query; `textColumns` = 0-based indices that accept string data.
    // ---------------------------------------------------------------
    const EXT_LABS = [
        {
            id: "lab4",
            num: "04",
            title: "UNION: Determine Number of Columns",
            difficulty: "Practitioner",
            goal: "Use a UNION-based injection to make the query return an additional row of data. First you must determine how many columns the original query returns.",
            columns: 3,
            textColumns: [0, 1, 2],
            hint: "The query returns a fixed number of columns. Use <code>' ORDER BY 1--</code>, <code>' ORDER BY 2--</code> ... until you get an error to count them, or inject <code>' UNION SELECT NULL--</code> and add NULLs until the error disappears.",
            steps: [
                { text: "Submit <code>' ORDER BY 1--</code>, then 2, 3, 4 ... The error appears once the number exceeds the real column count." },
                { text: "Submit <code>' UNION SELECT NULL--</code> and keep adding <code>,NULL</code> until the error disappears. That is the column count." },
                { text: "Solve: a UNION with the correct number of columns (3) runs with no error." }
            ],
            solve: (r) => r.unionOk && r.exprCount === 3
        },
        {
            id: "lab5",
            num: "05",
            title: "UNION: Find a Column Containing Text",
            difficulty: "Practitioner",
            goal: `Identify which column of the 3-column query can hold string data, then make the query return the value <code>${TEXT_MARKER}</code> in that column.`,
            columns: 3,
            textColumns: [1], // only the middle column is varchar
            targetString: TEXT_MARKER,
            hint: `Replace each NULL in turn with the string <code>'${TEXT_MARKER}'</code>. A non-text column throws a type-conversion error; the column that prints the string is the text column.`,
            steps: [
                { text: `Inject <code>' UNION SELECT '${TEXT_MARKER}',NULL,NULL--</code> - a type error means column 1 is not text.` },
                { text: `Try the next position: <code>' UNION SELECT NULL,'${TEXT_MARKER}',NULL--</code>.` },
                { text: `Solve: the response shows <code>${TEXT_MARKER}</code>, proving that column holds text.` }
            ],
            solve: (r) => r.unionOk && r.printedTarget
        },
        {
            id: "lab6",
            num: "06",
            title: "UNION: Retrieve Data From Other Tables",
            difficulty: "Practitioner",
            goal: "The 2-column query is vulnerable. Use UNION to retrieve the username and password of every user from the <code>users</code> table, including the administrator.",
            columns: 2,
            textColumns: [0, 1],
            hint: "Both columns are text. Inject <code>' UNION SELECT username, password FROM users--</code>.",
            steps: [
                { text: "Determine the columns (2) and that both are text." },
                { text: "Inject <code>' UNION SELECT username, password FROM users--</code>." },
                { text: "Solve: the administrator's credentials appear in the results." }
            ],
            solve: (r) => r.leakedAdminPassword
        },
        {
            id: "lab7",
            num: "07",
            title: "UNION: Multiple Values in a Single Column",
            difficulty: "Practitioner",
            goal: "The query returns 2 columns but only ONE holds text. Retrieve both the username and password of the administrator by concatenating them into that single text column.",
            columns: 2,
            textColumns: [1], // only column 2 is text
            hint: "Concatenate with <code>||</code>: inject <code>' UNION SELECT NULL, username || '~' || password FROM users--</code>.",
            steps: [
                { text: "Find that only one column (column 2) accepts text." },
                { text: "Concatenate username and password into it: <code>' UNION SELECT NULL, username || '~' || password FROM users--</code>." },
                { text: "Solve: the administrator's <code>username~password</code> appears in a single cell." }
            ],
            solve: (r) => r.leakedAdminPassword
        }
    ];

    // ---------------------------------------------------------------
    // UNION attack simulator. Returns a result object describing what
    // the (vulnerable) concatenated query would do.
    // ---------------------------------------------------------------
    function simulateUnion(input, lab) {
        const result = {
            error: null,
            rows: [],
            headers: [],
            unionOk: false,
            exprCount: 0,
            printedTarget: false,
            leakedAdminPassword: false,
            queryHtml: ""
        };

        // Split off an SQL comment (-- or #): everything after is inert.
        const commentMatch = input.match(/--|#/);
        const commented = !!commentMatch;
        const active = commented ? input.slice(0, input.indexOf(commentMatch[0])) : input;

        result.queryHtml = highlight(active, commented);

        // Quote-balance check (one opening quote is already in the template;
        // a trailing quote is added only when the payload is NOT commented).
        const q = (active.match(/'/g) || []).length;
        const balanced = commented ? q % 2 === 1 : q % 2 === 0;
        if (!balanced) {
            result.error = "SQL syntax error: unterminated quoted string near the category value. (The opening quote was never closed.)";
            return result;
        }

        // If no quote closes the string, the payload is inert data inside
        // the literal - the normal product filter just returns nothing new.
        const firstQuote = active.indexOf("'");
        if (firstQuote === -1) {
            result.rows = [];
            result.headers = colHeaders(lab.columns);
            return result;
        }

        // The injected clause is everything after the string-closing quote.
        const clause = active.slice(firstQuote + 1).trim();

        // ORDER BY n -> used to count columns.
        const orderBy = clause.match(/^ORDER\s+BY\s+(\d+)/i);
        if (orderBy) {
            const n = parseInt(orderBy[1], 10);
            if (n < 1 || n > lab.columns) {
                result.error = `The ORDER BY position number ${n} is out of range of the number of items in the select list.`;
            } else {
                result.rows = PRODUCTS.map((p) => fill(lab.columns, [p.category, p.name, "In stock"]));
                result.headers = colHeaders(lab.columns);
            }
            return result;
        }

        // UNION SELECT ...
        const union = clause.match(/UNION\s+(?:ALL\s+)?SELECT\s+(.+)$/i);
        if (!union) {
            // Some other injection - just show the base rows.
            result.rows = PRODUCTS.map((p) => fill(lab.columns, [p.category, p.name, "In stock"]));
            result.headers = colHeaders(lab.columns);
            return result;
        }

        const body = union[1];
        const fromUsers = /FROM\s+users/i.test(body);
        const selectList = fromUsers ? body.replace(/\s+FROM\s+users.*/i, "") : body;
        const exprs = splitTopLevel(selectList);
        result.exprCount = exprs.length;

        if (exprs.length !== lab.columns) {
            result.error =
                `The used SELECT statements have a different number of columns. ` +
                `The original query returns ${lab.columns} column(s); your UNION supplied ${exprs.length}.`;
            return result;
        }

        // Classify each expression and enforce column data types.
        const classified = [];
        for (let i = 0; i < exprs.length; i++) {
            const c = classify(exprs[i]);
            if (c.isText && lab.textColumns.indexOf(i) === -1) {
                result.error =
                    `Conversion failed when converting the value in column ${i + 1} to the column's data type. ` +
                    `(Column ${i + 1} is not a string column.)`;
                return result;
            }
            classified.push(c);
        }

        // The UNION is valid.
        result.unionOk = true;
        result.headers = colHeaders(lab.columns);

        // Base product rows first.
        result.rows = PRODUCTS.map((p) => fill(lab.columns, [p.category, p.name, "In stock"]));

        // Build the injected UNION rows.
        const sourceRows = fromUsers ? SECRET_USERS : [null];
        for (const u of sourceRows) {
            const row = classified.map((c) => evalExpr(c, u));
            result.rows.push(row);
            const joined = row.join(" | ");
            if (lab.targetString && joined.indexOf(lab.targetString) !== -1) result.printedTarget = true;
            if (joined.indexOf("4dm1n_un10n_p4ss") !== -1) result.leakedAdminPassword = true;
        }
        return result;
    }

    // Split a SELECT list on top-level commas (ignores commas inside quotes).
    function splitTopLevel(s) {
        const out = [];
        let depth = 0, inStr = false, cur = "";
        for (let i = 0; i < s.length; i++) {
            const ch = s[i];
            if (ch === "'") inStr = !inStr;
            if (!inStr && ch === "(") depth++;
            if (!inStr && ch === ")") depth--;
            if (!inStr && depth === 0 && ch === ",") { out.push(cur.trim()); cur = ""; continue; }
            cur += ch;
        }
        if (cur.trim() !== "") out.push(cur.trim());
        return out;
    }

    // Classify one UNION expression.
    function classify(expr) {
        const e = expr.trim();
        if (/^null$/i.test(e)) return { type: "null", isText: false };
        if (/^-?\d+(\.\d+)?$/.test(e)) return { type: "num", isText: false, value: e };
        // Concatenation with || or CONCAT(...) producing text.
        if (/\|\|/.test(e) || /^concat\s*\(/i.test(e)) return { type: "concat", isText: true, raw: e };
        if (/^'.*'$/.test(e)) return { type: "literal", isText: true, value: e.slice(1, -1) };
        if (/^username$/i.test(e)) return { type: "col", isText: true, col: "username" };
        if (/^password$/i.test(e)) return { type: "col", isText: true, col: "password" };
        // Any other bare identifier/string expression is treated as text.
        return { type: "expr", isText: true, value: e };
    }

    function evalExpr(c, user) {
        switch (c.type) {
            case "null": return "NULL";
            case "num": return c.value;
            case "literal": return c.value;
            case "col": return user ? user[c.col] : "NULL";
            case "concat": return evalConcat(c.raw, user);
            default: return c.value;
        }
    }

    // Evaluate username || '~' || password and CONCAT(username,'~',password).
    function evalConcat(raw, user) {
        const s = raw;
        const concat = s.match(/^concat\s*\((.*)\)$/i);
        const parts = concat ? splitTopLevel(concat[1]) : s.split("||");
        return parts
            .map((p) => {
                const t = p.trim();
                if (/^'.*'$/.test(t)) return t.slice(1, -1);
                if (/^username$/i.test(t)) return user ? user.username : "NULL";
                if (/^password$/i.test(t)) return user ? user.password : "NULL";
                if (/^null$/i.test(t)) return "";
                return t;
            })
            .join("");
    }

    function fill(n, vals) {
        const row = [];
        for (let i = 0; i < n; i++) row.push(i < vals.length ? vals[i] : "NULL");
        return row;
    }

    function colHeaders(n) {
        const names = ["column_1", "column_2", "column_3", "column_4", "column_5"];
        return names.slice(0, n);
    }

    function esc(s) {
        return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    // Render the live query with the injected portion highlighted.
    function highlight(active, commented) {
        const open = `<span class="sql-keyword">SELECT</span> * <span class="sql-keyword">FROM</span> <span class="sql-table">products</span> <span class="sql-keyword">WHERE</span> <span class="sql-column">category</span> = '`;
        const injected = `<span class="sql-injection-input">${esc(active)}</span>`;
        const tail = commented
            ? `<span class="sql-injection-comment">' AND released = 1</span>`
            : `' <span class="sql-keyword">AND</span> <span class="sql-column">released</span> = 1`;
        return open + injected + tail;
    }

    // =============================================================
    // Batch 2: Examining the database (version + list contents).
    // These are UNION-based too, but query DB metadata.
    // =============================================================

    // Deterministic "random-looking" schema for the list-contents lab.
    const DB_USERS_TABLE = "users_xTzQ";
    const DB_COL_USER = "username_hGvB";
    const DB_COL_PASS = "password_rPmK";

    const EXT_EXAMINE = [
        {
            id: "lab8",
            num: "08",
            section: "Examining the Database",
            scenario: "examine",
            title: "Query the DB Version (Oracle)",
            difficulty: "Practitioner",
            columns: 2,
            dbType: "oracle",
            versionString: "Oracle Database 11g Enterprise Edition Release 11.2.0.2.0 - 64bit Production",
            goal: "The back-end is Oracle. Display the database version string. On Oracle every SELECT needs a FROM clause, and version info lives in <code>v$version</code>.",
            hint: "Oracle: <code>' UNION SELECT BANNER, NULL FROM v$version--</code>. (A plain <code>SELECT</code> without <code>FROM</code> fails on Oracle - use <code>FROM dual</code> or <code>v$version</code>.)",
            steps: [
                { text: "Confirm 2 columns: <code>' UNION SELECT NULL,NULL FROM dual--</code> (Oracle needs FROM)." },
                { text: "Read the banner: <code>' UNION SELECT BANNER, NULL FROM v$version--</code>." },
                { text: "Solve: the Oracle version banner is shown." }
            ],
            solve: (r) => r.leakedVersion
        },
        {
            id: "lab9",
            num: "09",
            section: "Examining the Database",
            scenario: "examine",
            title: "Query the DB Version (MySQL / Microsoft)",
            difficulty: "Practitioner",
            columns: 2,
            dbType: "mysql",
            versionString: "8.0.36-0ubuntu0.22.04.1 (MySQL Community Server)",
            goal: "The back-end is MySQL / Microsoft SQL Server. Display the database version string using <code>@@version</code>.",
            hint: "MySQL/MSSQL: <code>' UNION SELECT @@version, NULL--</code>. On MySQL a space is needed after <code>--</code>, or use <code>#</code> as the comment.",
            steps: [
                { text: "Confirm 2 columns: <code>' UNION SELECT NULL,NULL-- </code>." },
                { text: "Read the version: <code>' UNION SELECT @@version, NULL-- </code> (or <code>version()</code>)." },
                { text: "Solve: the MySQL version string is shown." }
            ],
            solve: (r) => r.leakedVersion
        },
        {
            id: "lab10",
            num: "10",
            section: "Examining the Database",
            scenario: "examine",
            title: "List the Database Contents",
            difficulty: "Practitioner",
            columns: 2,
            dbType: "postgresql",
            goal: `Non-Oracle DB. Enumerate the schema via <code>information_schema</code>, find the users table and its columns, then dump the administrator's credentials.`,
            schema: {
                tables: [
                    { name: "products", columns: ["id", "released", "name"], rows: [] },
                    {
                        name: DB_USERS_TABLE,
                        columns: [DB_COL_USER, DB_COL_PASS],
                        rows: [
                            { [DB_COL_USER]: "administrator", [DB_COL_PASS]: "ex4m1ne_db_p4ss" },
                            { [DB_COL_USER]: "carlos", [DB_COL_PASS]: "montoya" },
                            { [DB_COL_USER]: "wiener", [DB_COL_PASS]: "peter" }
                        ]
                    }
                ]
            },
            hint: `1) List tables: <code>' UNION SELECT table_name, NULL FROM information_schema.tables--</code> → find <code>${DB_USERS_TABLE}</code>.<br>2) List its columns: <code>' UNION SELECT column_name, NULL FROM information_schema.columns WHERE table_name='${DB_USERS_TABLE}'--</code>.<br>3) Dump: <code>' UNION SELECT ${DB_COL_USER}, ${DB_COL_PASS} FROM ${DB_USERS_TABLE}--</code>.`,
            steps: [
                { text: "List tables with <code>information_schema.tables</code> and spot the users table." },
                { text: "List that table's columns with <code>information_schema.columns</code>." },
                { text: "Dump the credentials from the discovered table/columns. Solve when the administrator password appears." }
            ],
            solve: (r) => r.leakedAdminPassword
        }
    ];

    // ---------------------------------------------------------------
    // Simulator for the "examine the database" scenario.
    // ---------------------------------------------------------------
    function simulateExamine(input, lab) {
        const result = {
            error: null, rows: [], headers: [], unionOk: false, exprCount: 0,
            leakedVersion: false, leakedAdminPassword: false, queryHtml: ""
        };

        const commentMatch = input.match(/--|#/);
        const commented = !!commentMatch;
        const active = commented ? input.slice(0, input.indexOf(commentMatch[0])) : input;
        result.queryHtml = highlight(active, commented);

        const q = (active.match(/'/g) || []).length;
        const balanced = commented ? q % 2 === 1 : q % 2 === 0;
        if (!balanced) {
            result.error = "SQL syntax error: unterminated quoted string near the category value.";
            return result;
        }

        const firstQuote = active.indexOf("'");
        if (firstQuote === -1) { result.headers = colHeaders(lab.columns); return result; }
        const clause = active.slice(firstQuote + 1).trim();

        const orderBy = clause.match(/^ORDER\s+BY\s+(\d+)/i);
        if (orderBy) {
            const n = parseInt(orderBy[1], 10);
            if (n < 1 || n > lab.columns) result.error = `The ORDER BY position number ${n} is out of range of the number of items in the select list.`;
            else result.headers = colHeaders(lab.columns);
            return result;
        }

        const union = clause.match(/UNION\s+(?:ALL\s+)?SELECT\s+(.+)$/i);
        if (!union) { result.headers = colHeaders(lab.columns); return result; }

        let body = union[1];

        // Work out the FROM target and the rows it yields.
        const fromMatch = body.match(/\s+FROM\s+(.+)$/i);
        const fromClause = fromMatch ? fromMatch[1].trim() : "";
        const selectList = fromMatch ? body.slice(0, body.length - fromMatch[0].length) : body;
        const exprs = splitTopLevel(selectList);
        result.exprCount = exprs.length;

        if (exprs.length !== lab.columns) {
            result.error = `The used SELECT statements have a different number of columns. ` +
                `The original query returns ${lab.columns} column(s); your UNION supplied ${exprs.length}.`;
            return result;
        }

        // Oracle requires a FROM clause on every SELECT.
        if (lab.dbType === "oracle" && !fromClause) {
            result.error = "ORA-00923: FROM keyword not found where expected. (Oracle requires a FROM clause - try FROM dual.)";
            return result;
        }

        // Determine the row context(s) the FROM clause produces.
        let ctxRows = [{}];
        let sourceTable = null;
        if (/^v\$version/i.test(fromClause)) {
            ctxRows = [{ __banner: lab.versionString }];
        } else if (/^dual/i.test(fromClause) || fromClause === "") {
            ctxRows = [{}];
        } else if (/^information_schema\.tables/i.test(fromClause)) {
            ctxRows = (lab.schema ? lab.schema.tables : []).map((t) => ({ table_name: t.name }));
        } else if (/^information_schema\.columns/i.test(fromClause)) {
            const tn = fromClause.match(/table_name\s*=\s*'([^']+)'/i);
            const target = tn ? tn[1] : null;
            const tbl = lab.schema && lab.schema.tables.find((t) => t.name === target);
            ctxRows = tbl ? tbl.columns.map((c) => ({ column_name: c })) : [];
        } else {
            const name = fromClause.split(/\s|;/)[0];
            sourceTable = lab.schema && lab.schema.tables.find((t) => t.name === name);
            if (!sourceTable) {
                result.error = `ERROR: relation "${esc(name)}" does not exist.`;
                return result;
            }
            ctxRows = sourceTable.rows;
        }

        // Evaluate each expression for every context row.
        result.unionOk = true;
        result.headers = colHeaders(lab.columns);
        const rows = ctxRows.map((ctx) => exprs.map((e) => evalExamineExpr(e, ctx, lab, sourceTable)));
        result.rows = rows;

        const flat = rows.map((r) => r.join(" | ")).join(" || ");
        if (flat.indexOf(lab.versionString || "\u0000no\u0000") !== -1) result.leakedVersion = true;
        if (flat.indexOf("ex4m1ne_db_p4ss") !== -1) result.leakedAdminPassword = true;
        return result;
    }

    function evalExamineExpr(expr, ctx, lab, sourceTable) {
        const e = expr.trim();
        if (/^null$/i.test(e)) return "NULL";
        if (/^(@@version|version\s*\(\s*\)|banner)$/i.test(e)) {
            return ctx.__banner || lab.versionString || "NULL";
        }
        if (/^'.*'$/.test(e)) return e.slice(1, -1);
        if (/^-?\d+(\.\d+)?$/.test(e)) return e;
        if (/^table_name$/i.test(e)) return ctx.table_name !== undefined ? ctx.table_name : "NULL";
        if (/^column_name$/i.test(e)) return ctx.column_name !== undefined ? ctx.column_name : "NULL";
        // A real data column of the table being read.
        if (sourceTable && sourceTable.columns.indexOf(e) !== -1) return ctx[e];
        // Known metadata/value in the current row context.
        if (ctx[e] !== undefined) return ctx[e];
        return "NULL";
    }

    // =============================================================
    // UI construction
    // =============================================================
    const ALL_LABS = EXT_LABS.concat(EXT_EXAMINE);
    const LS_KEY = "sqli_ext_solved";
    const solved = loadSolved();

    function loadSolved() {
        try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; }
        catch { return {}; }
    }
    function saveSolved() {
        try { localStorage.setItem(LS_KEY, JSON.stringify(solved)); } catch { /* ignore */ }
    }

    function build() {
        const sidebarNav = document.querySelector(".sidebar nav");
        const main = document.querySelector(".main-content");
        const labsGrid = document.querySelector(".labs-grid");
        if (!sidebarNav || !main) return;

        // Group labs by their sidebar section, preserving first-seen order.
        const groups = [];
        ALL_LABS.forEach((lab) => {
            const name = lab.section || "UNION Attacks";
            let g = groups.find((x) => x.name === name);
            if (!g) { g = { name, labs: [] }; groups.push(g); }
            g.labs.push(lab);
        });

        groups.forEach((group) => {
            const title = document.createElement("div");
            title.className = "nav-section-title";
            title.textContent = group.name;
            const menu = document.createElement("ul");
            menu.className = "nav-menu";
            sidebarNav.appendChild(title);
            sidebarNav.appendChild(menu);

            group.labs.forEach((lab) => {
                // Nav item.
                const li = document.createElement("li");
                li.className = "nav-item" + (solved[lab.id] ? " solved" : "");
                li.setAttribute("data-ext-route", lab.id);
                li.innerHTML = `<i class="icon-db"></i> Lab ${parseInt(lab.num, 10)}: ${shortTitle(lab.title)} <span class="lab-badge">Lab</span>`;
                li.addEventListener("click", () => navigate(lab.id));
                menu.appendChild(li);

                // Dashboard card.
                if (labsGrid) {
                    const card = document.createElement("div");
                    card.className = "card lab-card" + (solved[lab.id] ? " solved" : "");
                    card.id = `card-${lab.id}`;
                    card.innerHTML = `
                        <div class="lab-header">
                            <div class="lab-num">Lab-${lab.num}</div>
                            <h3 class="lab-title">${lab.title}</h3>
                            <p class="lab-desc">${stripTags(lab.goal)}</p>
                        </div>
                        <div class="lab-footer">
                            <span class="lab-difficulty diff-medium">${lab.difficulty}</span>
                            <button class="lab-btn" data-ext-navigate="${lab.id}">Start Lab</button>
                        </div>`;
                    card.querySelector("[data-ext-navigate]").addEventListener("click", () => navigate(lab.id));
                    labsGrid.appendChild(card);
                }

                // Lab page.
                const page = document.createElement("div");
                page.id = `${lab.id}-page`;
                page.className = "page-container ext-lab-page";
                page.innerHTML = pageHtml(lab);
                main.appendChild(page);
                wireLab(lab, page);
            });
        });

        // When a legacy nav item is clicked, hide our pages too.
        document.querySelectorAll(".nav-item[data-route]").forEach((item) => {
            item.addEventListener("click", () => setTimeout(hideExtPages, 0));
        });

        // Reset-progress button (clears solved state + forces a fresh,
        // cache-busting reload so new labs always show up).
        addResetButton();

        // Keep the Academy Status counter in sync across all labs.
        watchProgress();
    }

    function addResetButton() {
        const panel = document.querySelector(".settings-panel") || document.querySelector(".sidebar");
        if (!panel || document.getElementById("ext-reset-btn")) return;
        const btn = document.createElement("button");
        btn.id = "ext-reset-btn";
        btn.className = "ext-reset-btn";
        btn.innerHTML = "🔄 Reset Labs";
        btn.title = "Clear all solved progress and reload the latest labs";
        btn.addEventListener("click", () => {
            try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
            // Cache-busting reload so a stale page can never hide new labs.
            window.location.href = window.location.pathname + "?r=" + Date.now();
        });
        panel.appendChild(btn);
    }

    function shortTitle(t) {
        return t.replace(/^UNION:\s*/, "").replace("Determine Number of Columns", "Column Count")
            .replace("Find a Column Containing Text", "Text Column")
            .replace("Retrieve Data From Other Tables", "Read Other Tables")
            .replace("Multiple Values in a Single Column", "Single Column")
            .replace("Query the DB Version (Oracle)", "DB Version (Oracle)")
            .replace("Query the DB Version (MySQL / Microsoft)", "DB Version (MySQL)")
            .replace("List the Database Contents", "List DB Contents");
    }
    function stripTags(h) { return h.replace(/<[^>]+>/g, ""); }

    function pageHtml(lab) {
        const steps = lab.steps.map((s, i) => `<li><span class="ext-step-num">${i + 1}</span> ${s.text}</li>`).join("");
        return `
            <header class="top-header" style="margin-bottom:18px;">
                <div class="welcome-msg">
                    <h1>Lab ${parseInt(lab.num, 10)}: ${lab.title}</h1>
                    <p>${lab.difficulty} &middot; SQL injection UNION attack</p>
                </div>
            </header>
            <div class="card" style="padding:18px; margin-bottom:16px;">
                <h3 style="margin-top:0;">🎯 Goal</h3>
                <p>${lab.goal}</p>
                <div class="ext-status" id="${lab.id}-status">${solved[lab.id] ? "✅ Solved" : "🔓 Not solved yet"}</div>
            </div>
            <div class="card" style="padding:18px; margin-bottom:16px;">
                <h3 style="margin-top:0;">🛒 Product Category Filter (vulnerable)</h3>
                <p style="color:var(--text-muted);font-size:13px;">The category value is concatenated straight into the SQL query.</p>
                <div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0;">
                    <input type="text" class="form-input" id="${lab.id}-input" placeholder="e.g. Gifts' UNION SELECT NULL--" style="flex:1;min-width:260px;">
                    <button class="lab-btn" id="${lab.id}-run">Run Query</button>
                </div>
                <div style="margin:6px 0 4px;color:var(--text-muted);font-size:12px;">Executed SQL:</div>
                <div class="sql-query-view" id="${lab.id}-sql" style="font-size:13px;padding:10px;"></div>
                <div id="${lab.id}-error" class="ext-error"></div>
                <div id="${lab.id}-results" class="ext-results"></div>
            </div>
            <div class="card" style="padding:18px;">
                <h3 style="margin-top:0;">🧭 Steps</h3>
                <ul class="ext-steps">${steps}</ul>
                <details style="margin-top:10px;"><summary style="cursor:pointer;color:var(--accent,#60a5fa);">Show hint</summary>
                    <p style="margin-top:8px;">${lab.hint}</p></details>
            </div>`;
    }

    function wireLab(lab, page) {
        const input = page.querySelector(`#${lab.id}-input`);
        const run = page.querySelector(`#${lab.id}-run`);
        const act = () => runLab(lab, page, input.value);
        run.addEventListener("click", act);
        input.addEventListener("keydown", (e) => { if (e.key === "Enter") act(); });
    }

    function runLab(lab, page, value) {
        const res = lab.scenario === "examine" ? simulateExamine(value, lab) : simulateUnion(value, lab);
        page.querySelector(`#${lab.id}-sql`).innerHTML = res.queryHtml;

        const errBox = page.querySelector(`#${lab.id}-error`);
        const resBox = page.querySelector(`#${lab.id}-results`);
        if (res.error) {
            errBox.innerHTML = `<span class="ext-err-badge">SQL ERROR</span> ${esc(res.error)}`;
            resBox.innerHTML = "";
        } else {
            errBox.innerHTML = "";
            resBox.innerHTML = renderTable(res);
        }

        if (!solved[lab.id] && lab.solve(res)) markSolved(lab, page);
    }

    function renderTable(res) {
        if (!res.rows.length) return `<p style="color:var(--text-muted);font-size:13px;">No rows returned.</p>`;
        const head = res.headers.map((h) => `<th>${esc(h)}</th>`).join("");
        const body = res.rows
            .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
            .join("");
        return `<div style="overflow:auto;"><table class="ext-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
    }

    function markSolved(lab, page) {
        solved[lab.id] = true;
        saveSolved();
        page.querySelector(`#${lab.id}-status`).textContent = "✅ Solved";
        document.querySelector(`[data-ext-route="${lab.id}"]`)?.classList.add("solved");
        document.getElementById(`card-${lab.id}`)?.classList.add("solved");
        toast(`Lab ${parseInt(lab.num, 10)} solved! 🏆`, lab.title);
        updateCombinedProgress();
    }

    function toast(title, msg) {
        let el = document.getElementById("ext-toast");
        if (!el) {
            el = document.createElement("div");
            el.id = "ext-toast";
            el.className = "ext-toast";
            document.body.appendChild(el);
        }
        el.innerHTML = `<div class="ext-toast-icon">🏆</div><div><strong>${esc(title)}</strong><br><span>${esc(msg)}</span></div>`;
        el.classList.add("show");
        clearTimeout(el._t);
        el._t = setTimeout(() => el.classList.remove("show"), 4000);
    }

    function hideExtPages() {
        document.querySelectorAll(".ext-lab-page").forEach((p) => p.classList.remove("active"));
    }

    // Combined progress counter: legacy labs (3) + all extension labs.
    // Idempotent: only writes when the text actually changes, so the
    // MutationObserver that re-applies it can never loop.
    function updateCombinedProgress() {
        const text = document.getElementById("progress-text");
        if (!text) return;
        const bar = document.getElementById("progress-bar-fill");
        const legacySolved = document.querySelectorAll('.nav-item[data-route^="lab"].solved').length;
        const extSolved = Object.keys(solved).filter((k) => solved[k]).length;
        const total = 3 + ALL_LABS.length;
        const count = legacySolved + extSolved;
        const desired = `${count} / ${total} Solved`;
        if (text.innerText !== desired) text.innerText = desired;
        if (bar) {
            const w = `${(count / total) * 100}%`;
            if (bar.style.width !== w) bar.style.width = w;
        }
    }

    function watchProgress() {
        const text = document.getElementById("progress-text");
        if (!text) return;
        // Re-apply the combined total whenever app.js rewrites the counter.
        // The write is a no-op when already correct, so no infinite loop.
        new MutationObserver(() => updateCombinedProgress())
            .observe(text, { childList: true, characterData: true });
        updateCombinedProgress();
    }

    function navigate(id) {
        document.querySelectorAll(".page-container").forEach((p) => p.classList.remove("active"));
        document.getElementById(`${id}-page`)?.classList.add("active");
        document.querySelectorAll(".nav-item").forEach((n) => n.classList.remove("active"));
        document.querySelector(`[data-ext-route="${id}"]`)?.classList.add("active");
        window.scrollTo(0, 0);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", build);
    } else {
        build();
    }

    // Expose for debugging / tests.
    window.__sqliExt = { simulateUnion, simulateExamine, EXT_LABS, EXT_EXAMINE, ALL_LABS };
    console.log("SQLi extension labs (UNION batch) loaded.");
})();
