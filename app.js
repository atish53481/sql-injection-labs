// Application Controller

document.addEventListener("DOMContentLoaded", () => {
    // Application State
    const state = {
        currentRoute: "home",
        solvedLabs: {
            lab1: false,
            lab2: false,
            lab3: false
        },
        eli5Mode: false,
        currentUser: null, // Track logged in user in Lab 2
        activeGuideTab: "guide" // guide vs theory
    };

    // DOM Elements
    const navItems = document.querySelectorAll(".nav-item[data-route]");
    const pages = document.querySelectorAll(".page-container");
    const progressText = document.getElementById("progress-text");
    const progressBarFill = document.getElementById("progress-bar-fill");
    const eli5Toggle = document.getElementById("eli5-toggle");
    
    // Success Overlay Elements
    const successOverlay = document.getElementById("success-overlay");
    const successTitle = document.getElementById("success-title");
    const successMsg = document.getElementById("success-msg");
    const successNextBtn = document.getElementById("success-next-btn");
    
    // Confetti canvas
    const confettiCanvas = document.getElementById("confetti-canvas");
    let confettiCtx = confettiCanvas ? confettiCanvas.getContext("2d") : null;
    let confettiAnimationId = null;
    let particles = [];

    // ==========================================
    // Navigation Routing System
    // ==========================================
    function initNavigation() {
        navItems.forEach(item => {
            item.addEventListener("click", () => {
                const route = item.getAttribute("data-route");
                navigate(route);
            });
        });
        
        // Dashboard "Get Started" buttons
        document.querySelectorAll("[data-navigate]").forEach(btn => {
            btn.addEventListener("click", () => {
                const target = btn.getAttribute("data-navigate");
                navigate(target);
            });
        });
    }

    function navigate(route) {
        state.currentRoute = route;
        
        // Update sidebar active state
        navItems.forEach(item => {
            if (item.getAttribute("data-route") === route) {
                item.classList.add("active");
            } else {
                item.classList.remove("active");
            }
        });

        // Toggle page visibility
        pages.forEach(page => {
            if (page.id === `${route}-page`) {
                page.classList.add("active");
            } else {
                page.classList.remove("active");
            }
        });

        // Additional route-specific resets
        if (route === "lab1") {
            resetLab1();
        } else if (route === "lab2") {
            resetLab2();
        } else if (route === "lab3") {
            resetLab3();
        }
        
        // Hide success overlay when navigating
        closeSuccess();
    }

    // ==========================================
    // Progress Tracking
    // ==========================================
    function updateProgress() {
        const solvedCount = Object.values(state.solvedLabs).filter(v => v).length;
        const total = 3;
        const percent = (solvedCount / total) * 100;
        
        if (progressText) {
            progressText.innerText = `${solvedCount} / ${total} Solved`;
        }
        if (progressBarFill) {
            progressBarFill.style.width = `${percent}%`;
        }

        // Update sidebar checks
        Object.keys(state.solvedLabs).forEach(labId => {
            const sidebarItem = document.querySelector(`.nav-item[data-route="${labId}"]`);
            if (sidebarItem) {
                if (state.solvedLabs[labId]) {
                    sidebarItem.classList.add("solved");
                    sidebarItem.querySelector(".lab-badge").innerText = "Solved";
                } else {
                    sidebarItem.classList.remove("solved");
                    sidebarItem.querySelector(".lab-badge").innerText = "Lab";
                }
            }
            
            // Dashboard card checks
            const card = document.getElementById(`card-${labId}`);
            if (card) {
                if (state.solvedLabs[labId]) {
                    card.classList.add("solved");
                    card.querySelector(".lab-btn").innerText = "Restart Lab";
                } else {
                    card.classList.remove("solved");
                    card.querySelector(".lab-btn").innerText = "Start Lab";
                }
            }
        });
    }

    // ==========================================
    // ELI5 (Explain Like I'm 5) System
    // ==========================================
    function initEli5Toggle() {
        if (eli5Toggle) {
            eli5Toggle.addEventListener("change", (e) => {
                state.eli5Mode = e.target.checked;
                document.querySelectorAll(".eli5-toggle-label").forEach(lbl => {
                    lbl.innerText = state.eli5Mode ? "ELI5: Enabled 🧸" : "ELI5: Disabled ⚙️";
                });
                renderAllGuides();
            });
        }
    }

    function renderAllGuides() {
        // Renders visual analogies for all lab instruction screens
        ["lab1", "lab2", "lab3"].forEach(labId => {
            const contentDiv = document.getElementById(`${labId}-guide-content`);
            if (!contentDiv) return;
            
            const config = window.LAB_CONFIGS[labId];
            
            let html = `<h3>${config.title}</h3>`;
            html += `<p class="lab-num">${config.subtitle} • Difficulty: ${config.difficulty}</p>`;
            
            if (state.eli5Mode) {
                html += config.eli5;
            } else {
                html += `<p><strong>Goal:</strong> ${config.goal}</p>`;
                html += `<p><strong>Vulnerable query structure:</strong></p>`;
                html += `<pre style="font-family: var(--font-mono); font-size:11.5px; background:var(--color-code-bg); padding:10px; border-radius:4px; color:var(--color-primary); overflow-x:auto; margin-bottom:12px;">${config.sqlTemplate}</pre>`;
            }
            
            html += `<h4>Step-by-Step Instructions:</h4><ol>`;
            config.steps.forEach(s => {
                html += `<li>${s.text}</li>`;
            });
            html += `</ol>`;
            
            contentDiv.innerHTML = html;
            setupVocabularyTooltips(contentDiv);
        });
    }

    // Hook up vocabulary hovering
    function setupVocabularyTooltips(container) {
        const words = {
            "SQL Injection": "sqli",
            "SQL injection": "sqli",
            "SQL": "sql",
            "database": "database",
            "databases": "database",
            "query": "query",
            "queries": "query",
            "comment": "comment",
            "comments": "comment",
            "UNION": "union",
            "WAF": "waf",
            "parameterized": "parameterized"
        };
        
        // Find textual matches and wrap in vocab-tag spans
        // Simple search-replace that avoids breaking html tags
        let textContent = container.innerHTML;
        
        // Sort keys by length descending to match longer phrases first (e.g. "SQL Injection" before "SQL")
        const sortedKeys = Object.keys(words).sort((a,b) => b.length - a.length);
        
        // A basic text-replacement parser
        // (For education, keep it simple by adding vocabulary tags next to key points in the text)
        // To be safe, we only hook click tooltips to manually annotated items, 
        // or wrap occurrences in the text directly.
        container.querySelectorAll("strong, li, p").forEach(el => {
            let html = el.innerHTML;
            sortedKeys.forEach(word => {
                // Regex word boundary, but avoiding wrapping matches inside tags
                const regex = new RegExp(`\\b(${word})\\b(?![^<]*>)`, 'g');
                html = html.replace(regex, `<span class="vocab-tag" data-vocab="${words[word]}">$1</span>`);
            });
            el.innerHTML = html;
        });

        // Set up events on all vocab-tags
        container.querySelectorAll(".vocab-tag").forEach(tag => {
            tag.addEventListener("click", (e) => {
                showVocabTooltip(e.target, tag.getAttribute("data-vocab"));
            });
        });
    }

    function showVocabTooltip(element, vocabKey) {
        const details = window.VOCABULARY[vocabKey];
        if (!details) return;
        
        let tooltip = document.getElementById("vocab-tooltip");
        if (!tooltip) {
            tooltip = document.createElement("div");
            tooltip.id = "vocab-tooltip";
            tooltip.className = "vocab-tooltip";
            document.body.appendChild(tooltip);
        }
        
        tooltip.innerHTML = `<h5>${details.title}</h5><p>${details.desc}</p>`;
        tooltip.style.display = "block";
        
        const rect = element.getBoundingClientRect();
        tooltip.style.left = `${rect.left + window.scrollX}px`;
        tooltip.style.top = `${rect.bottom + window.scrollY + 6}px`;
        
        // Close tooltip when clicking outside
        const closeHandler = (e) => {
            if (!tooltip.contains(e.target) && e.target !== element) {
                tooltip.style.display = "none";
                document.removeEventListener("click", closeHandler);
            }
        };
        setTimeout(() => document.addEventListener("click", closeHandler), 10);
    }

    // ==========================================
    // Lab 1 Logic: Product Category Filter
    // ==========================================
    const l1CategorySelect = document.getElementById("l1-category-select");
    const l1ProductsGrid = document.getElementById("l1-products");
    const l1SqlQuery = document.getElementById("l1-sql-query");
    const l1SqlError = document.getElementById("l1-sql-error");
    const l1UrlParam = document.getElementById("l1-url-param");
    const l1RowsCount = document.getElementById("l1-rows-count");
    const l1DbTableBody = document.getElementById("l1-db-table-body");
    const l1CustomInput = document.getElementById("l1-custom-input");
    const l1InjectBtn = document.getElementById("l1-inject-btn");

    function initLab1() {
        if (l1CategorySelect) {
            l1CategorySelect.addEventListener("change", (e) => {
                runLab1Query(e.target.value, "dropdown");
            });
        }
        
        // Custom injection text input
        if (l1CustomInput) {
            l1CustomInput.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    runLab1Query(l1CustomInput.value, "custom");
                }
            });
        }
        if (l1InjectBtn) {
            l1InjectBtn.addEventListener("click", () => {
                if (l1CustomInput) {
                    runLab1Query(l1CustomInput.value, "custom");
                }
            });
        }
        
        // Editable URL bar parameter
        if (l1UrlParam) {
            l1UrlParam.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    const raw = l1UrlParam.innerText.trim();
                    const decoded = decodeURIComponent(raw);
                    runLab1Query(decoded, "urlbar");
                }
            });
            // Also run on blur (click away)
            l1UrlParam.addEventListener("blur", () => {
                const raw = l1UrlParam.innerText.trim();
                const decoded = decodeURIComponent(raw);
                runLab1Query(decoded, "urlbar");
            });
        }
        
        // Add clicks for Lab 1 payload helper items
        document.querySelectorAll("#lab1-payloads .payload-item").forEach(item => {
            item.addEventListener("click", () => {
                const code = item.querySelector(".payload-code").innerText;
                // Add value to option or directly trigger injection
                if (l1CategorySelect) {
                    // Inject directly! Create option if needed, select it, and query
                    let option = Array.from(l1CategorySelect.options).find(opt => opt.value === code);
                    if (!option) {
                        option = document.createElement("option");
                        option.value = code;
                        option.text = `Inject: ${code.slice(0, 15)}...`;
                        l1CategorySelect.add(option);
                    }
                    l1CategorySelect.value = code;
                    runLab1Query(code, "payload");
                }
            });
        });

        resetLab1();
    }

    function resetLab1() {
        if (l1CategorySelect) l1CategorySelect.value = "Gifts";
        if (l1CustomInput) l1CustomInput.value = "";
        runLab1Query("Gifts", "reset");
    }

    function runLab1Query(inputValue, source) {
        // Run against mock DB
        const result = window.mockDb.queryCategory(inputValue);
        
        // 1. Update SQL Debugger
        l1SqlQuery.innerHTML = result.highlightedQuery;
        
        // 2. Sync all input sources (avoid overwriting the one user is typing in)
        if (source !== "urlbar" && l1UrlParam) {
            l1UrlParam.innerText = encodeURIComponent(inputValue);
        }
        if (source !== "custom" && l1CustomInput) {
            l1CustomInput.value = inputValue;
        }
        
        // 3. Render errors
        if (!result.success) {
            l1SqlError.innerText = result.error;
            l1SqlError.classList.add("active");
            l1ProductsGrid.innerHTML = `<div style="grid-column: 1/-1; padding: 40px; text-align: center; color: var(--color-error); font-weight: 500;">
                <span style="font-size: 32px; display: block; margin-bottom: 8px;">⚠️</span>
                Database Query Error. Check console logs below for syntax failures.
            </div>`;
            l1RowsCount.innerText = "0 rows returned";
            renderDbTableVisual(l1DbTableBody, [], "products");
            return;
        }

        l1SqlError.classList.remove("active");
        l1RowsCount.innerText = `${result.rows.length} rows returned`;

        // 4. Render products to Simulated Browser
        if (result.rows.length === 0) {
            l1ProductsGrid.innerHTML = `<div style="grid-column: 1/-1; padding: 40px; text-align: center; color: var(--text-muted);">No products found in this category.</div>`;
        } else {
            l1ProductsGrid.innerHTML = result.rows.map(p => `
                <div class="product-item">
                    <div class="product-img">${p.image}</div>
                    <div class="product-name">${p.name}</div>
                    <div class="product-price">$${p.price}</div>
                    ${p.released === 0 ? `<div class="product-status-tag status-unreleased">Unreleased 🤫</div>` : `<div class="product-status-tag status-released">Released</div>`}
                </div>
            `).join('');
        }

        // 5. Render Database Visual table
        renderDbTableVisual(l1DbTableBody, result.rows, "products");

        // 6. Check Win Condition
        // Solved if they retrieved any product with released = 0
        const hasUnreleased = result.rows.some(p => p.released === 0);
        if (hasUnreleased && !state.solvedLabs.lab1) {
            state.solvedLabs.lab1 = true;
            updateProgress();
            triggerSuccess("Lab Solved: Retrieving Hidden Data!", "Awesome! You commented out the <code>AND released=1</code> safety check by using SQL comment characters (<code>'--</code>). This tricked the database into returning unreleased items from the store cupboard!", "lab2");
        }
    }

    // ==========================================
    // Lab 2 Logic: Subverting Application Logic (Login)
    // ==========================================
    const l2UsernameInput = document.getElementById("l2-username");
    const l2PasswordInput = document.getElementById("l2-password");
    const l2LoginForm = document.getElementById("l2-login-form");
    const l2LoginFormContainer = document.getElementById("l2-login-container");
    const l2ProfileContainer = document.getElementById("l2-profile-container");
    const l2LoggedInUser = document.getElementById("l2-logged-in-user");
    const l2LogoutBtn = document.getElementById("l2-logout-btn");
    const l2SqlQuery = document.getElementById("l2-sql-query");
    const l2SqlError = document.getElementById("l2-sql-error");
    const l2DbTableBody = document.getElementById("l2-db-table-body");
    const l2ProfileRole = document.getElementById("l2-profile-role");
    
    function initLab2() {
        if (l2LoginForm) {
            l2LoginForm.addEventListener("submit", (e) => {
                e.preventDefault();
                runLab2Query(l2UsernameInput.value, l2PasswordInput.value);
            });
        }
        
        if (l2LogoutBtn) {
            l2LogoutBtn.addEventListener("click", () => {
                state.currentUser = null;
                resetLab2();
            });
        }

        // Lab 2 Helper payloads
        document.querySelectorAll("#lab2-payloads .payload-item").forEach(item => {
            item.addEventListener("click", () => {
                const code = item.querySelector(".payload-code").innerText;
                if (l2UsernameInput) {
                    l2UsernameInput.value = code;
                    l2PasswordInput.value = "";
                    // Give a visual nudge to submit
                    l2UsernameInput.classList.add("injected-style");
                    setTimeout(() => l2UsernameInput.classList.remove("injected-style"), 1000);
                }
            });
        });

        resetLab2();
    }

    function resetLab2() {
        if (l2UsernameInput) l2UsernameInput.value = "";
        if (l2PasswordInput) l2PasswordInput.value = "";
        if (l2LoginFormContainer) l2LoginFormContainer.style.display = "block";
        if (l2ProfileContainer) l2ProfileContainer.style.display = "none";
        
        runLab2Query("", "");
    }

    function runLab2Query(username, password) {
        const result = window.mockDb.queryLogin(username, password);
        
        // 1. Update SQL Debugger query text
        l2SqlQuery.innerHTML = result.highlightedQuery;

        // 2. Render Errors
        if (!result.success) {
            l2SqlError.innerText = result.error;
            l2SqlError.classList.add("active");
            renderDbTableVisual(l2DbTableBody, [], "users");
            return;
        }

        l2SqlError.classList.remove("active");

        // 3. Update Database Visual Table
        const selectedUsers = result.user ? [result.user] : [];
        renderDbTableVisual(l2DbTableBody, selectedUsers, "users");

        // 4. Handle login logic
        if (result.user && username !== "" && password !== "") {
            // Success login
            state.currentUser = result.user;
            l2LoginFormContainer.style.display = "none";
            l2ProfileContainer.style.display = "block";
            l2LoggedInUser.innerText = result.user.username;
            l2ProfileRole.innerText = result.user.role;
            
            // Check win condition (must be logged in as administrator)
            if (result.user.username === "administrator" && !state.solvedLabs.lab2) {
                state.solvedLabs.lab2 = true;
                updateProgress();
                triggerSuccess("Lab Solved: Subverting Logic!", "Spectacular! You bypassed authentication by injecting <code>administrator'--</code>. The comment tags ignored the password check entirely, letting you walk straight in as the system Administrator!", "lab3");
            }
        } else if (username !== "" && password !== "") {
            // Failed login (both fields had content, but no user matches)
            alert("Invalid username or password!");
        }
    }

    // ==========================================
    // Lab 3 Logic: WAF Stock Bypass via XML
    // ==========================================
    const l3XmlTextarea = document.getElementById("l3-xml-input");
    const l3CheckStockBtn = document.getElementById("l3-check-btn");
    const l3StockResponse = document.getElementById("l3-stock-response");
    const l3WafLogs = document.getElementById("l3-waf-logs");
    const l3SqlQuery = document.getElementById("l3-sql-query");
    const l3SqlError = document.getElementById("l3-sql-error");
    const l3DbTableBody = document.getElementById("l3-db-table-body");
    const l3EncodeBtn = document.getElementById("l3-encode-btn");
    const l3EncodeInput = document.getElementById("l3-encode-input");
    const l3EncodeOutput = document.getElementById("l3-encode-output");

    function initLab3() {
        if (l3CheckStockBtn) {
            l3CheckStockBtn.addEventListener("click", () => {
                runLab3Query(l3XmlTextarea.value);
            });
        }

        if (l3EncodeBtn) {
            l3EncodeBtn.addEventListener("click", () => {
                const rawText = l3EncodeInput.value;
                const encoded = window.encodeXmlHex(rawText);
                l3EncodeOutput.value = encoded;
            });
        }

        // XML payload list click
        document.querySelectorAll("#lab3-payloads .payload-item").forEach(item => {
            item.addEventListener("click", () => {
                const code = item.querySelector(".payload-code").innerText;
                // Build an XML payload
                const xmlPayload = `<stockCheck>\n    <productId>1</productId>\n    <storeId>${code}</storeId>\n</stockCheck>`;
                if (l3XmlTextarea) {
                    l3XmlTextarea.value = xmlPayload;
                }
            });
        });

        resetLab3();
    }

    function resetLab3() {
        if (l3XmlTextarea) {
            l3XmlTextarea.value = `<stockCheck>\n    <productId>1</productId>\n    <storeId>1</storeId>\n</stockCheck>`;
        }
        if (l3StockResponse) {
            l3StockResponse.innerHTML = "Stock level will display here.";
        }
        if (l3WafLogs) {
            l3WafLogs.innerHTML = `<span style="color:var(--text-muted);">Idle. Click Check Stock to send XML request...</span>`;
        }
        
        runLab3Query(`<stockCheck>\n    <productId>1</productId>\n    <storeId>1</storeId>\n</stockCheck>`, true); // silent load
    }

    function runLab3Query(xmlString, isSilent = false) {
        // 1. WAF Analysis (runs on raw XML string!)
        const wafResult = window.checkWAF(xmlString);
        
        if (!isSilent) {
            l3WafLogs.innerHTML = `
                <div style="margin-bottom:4px;">[14:04:12] Inspecting Incoming XML Payload...</div>
                <div style="${wafResult.blocked ? 'color:var(--color-error)' : 'color:var(--color-success)'}">
                    ${wafResult.blocked ? '❌ ' : '✅ '}${wafResult.reason}
                </div>
            `;
        }

        if (wafResult.blocked && !isSilent) {
            l3StockResponse.innerHTML = `<div class="waf-block-banner">
                <span>🚫</span> Access Denied. Malicious SQL pattern blocked by firewall.
            </div>`;
            
            // WAF blocks query from reaching database, so database shows idle
            l3SqlQuery.innerHTML = `<span style="color:var(--text-muted);">[BLOCKED BY WAF - QUERY NEVER REACHED DATABASE]</span>`;
            l3SqlError.classList.remove("active");
            renderDbTableVisual(l3DbTableBody, [], "stocks");
            return;
        }

        // 2. XML Parser & Decode Numeric Entities
        // In real app, the server decodes entities (e.g. &#x53; -> S)
        const parsedXml = window.decodeXmlEntities(xmlString);
        
        if (!isSilent) {
            l3WafLogs.innerHTML += `<div style="color:var(--color-primary); margin-top: 4px;">🔧 XML Entities Decoded: Passed to SQL Interpreter.</div>`;
        }

        // Extract <storeId> value
        const storeIdMatch = parsedXml.match(/<storeId>([\s\S]*?)<\/storeId>/i);
        const storeIdInput = storeIdMatch ? storeIdMatch[1].trim() : "1";
        
        // Simulating SQL Stock query: SELECT stock FROM store_stocks WHERE product_id = 1 AND store_id = [INPUT]
        // Since we want to let users use UNION in stock, we can route this query through a simulated category-like executor
        // Let's implement stock evaluation. If input has UNION, we return custom records.
        const queryTemplate = `SELECT stock FROM store_stocks WHERE product_id = 1 AND store_id = ${storeIdInput}`;
        let activeQuery = queryTemplate;
        let isCommented = false;
        let commentContent = "";

        const commentMatch = storeIdInput.match(/(--|#)/);
        if (commentMatch) {
            isCommented = true;
            const index = storeIdInput.indexOf(commentMatch[0]);
            const activeInput = storeIdInput.substring(0, index);
            commentContent = storeIdInput.substring(index);
            activeQuery = `SELECT stock FROM store_stocks WHERE product_id = 1 AND store_id = ${activeInput}`;
        }

        // Quotes Check
        const quoteCount = (activeQuery.match(/'/g) || []).length;
        if (quoteCount % 2 !== 0) {
            if (!isSilent) {
                l3SqlQuery.innerHTML = window.mockDb.highlightSQL(queryTemplate, storeIdInput, isCommented, commentContent);
                l3SqlError.innerText = "SQL Server Error: Unclosed quotation mark near 'store_id = 1 AND...'";
                l3SqlError.classList.add("active");
                l3StockResponse.innerHTML = `<span style="color:var(--color-error)">Database syntax error. Check query monitor.</span>`;
                renderDbTableVisual(l3DbTableBody, [], "stocks");
            }
            return;
        }

        l3SqlError.classList.remove("active");
        l3SqlQuery.innerHTML = window.mockDb.highlightSQL(queryTemplate, storeIdInput, isCommented, commentContent);

        // Evaluate results
        let results = [];
        let isUnionAttack = false;
        let unionRows = [];

        const cleanedInput = isCommented ? storeIdInput.split(/--|#/)[0] : storeIdInput;
        
        // Handle UNION query
        const unionMatch = cleanedInput.match(/UNION\s+SELECT\s+(.+)/i);
        if (unionMatch) {
            isUnionAttack = true;
            const unionBody = unionMatch[1].trim();
            const expressions = unionBody.split(',').map(e => e.trim());
            
            // Expected 1 column because stock query only pulls `stock` (1 column)!
            // Wait, in our instructions we did 6 columns or did we?
            // "Expected 1 column" -> In a stock check, the original SELECT is just `stock` (1 column).
            // But wait! If the original is 1 column, you can only pull 1 column of data!
            // Wait, if it has 1 column, how can they select multiple columns?
            // Ah! PortSwigger UNION lab has products category (which has multiple columns e.g. 2 or 3 columns).
            // In the user's notes:
            // "Vul app: SQL injection vulnerability in its stock check feature. Can use a UNION attack to retrieve data from other tables... 
            // Goal: contains a users table, which contains the usernames and passwords of registered users."
            // Wait, does the stock check have multiple columns, or does a stock check return stock counts?
            // Usually, a stock check query retrieves only 1 value (stock count), which means UNION SELECT must return 1 column!
            // E.g. UNION SELECT username || ':' || password FROM users-- (concatenated!)
            // Or let's see. If the original query retrieves 1 column:
            // `UNION SELECT password FROM users--`
            // That works!
            // Let's check expressions count. Let's make it accept 1 column, or if they write `UNION SELECT password FROM users`, it has 1 column and succeeds!
            // Wait! In the guide step 4, we wrote:
            // `1 UNION SELECT NULL, username, password, NULL, NULL, NULL FROM users--` (Wait, that is 6 columns, which fits products category filter).
            // Let's make our WAF XML lab accept EITHER 1 column (matching a simple stock query) or let's say the stock query has 1 column. 
            // Wait! If the step 4 guide says:
            // `1 UNION SELECT NULL, username, password, NULL, NULL, NULL FROM users--`
            // Then let's make the simulated query for stock check fetch 6 columns so that payload works exactly as written!
            // Let's assume the simulated stock query is:
            // `SELECT store_id, product_id, stock, NULL, NULL, NULL FROM store_stocks WHERE product_id = 1 AND store_id = [INPUT]`
            // Wait! That way it has exactly 6 columns, so the user can use the same 6-column payload!
            // Let's implement that! If the user provides 6 columns, it works!
            // If they provide a different number, we throw the column mismatch error!
            // Let's see: `expressions.length !== 1` or `expressions.length !== 6`?
            // Let's support both 1 column and 6 columns. That way, it's extremely friendly!
            // Let's check:
            const colCount = expressions.length;
            if (colCount !== 1 && colCount !== 6) {
                if (!isSilent) {
                    l3SqlError.innerText = `SQL Server Error: All queries combined using a UNION operator must have an equal number of expressions. Expected 1 or 6 columns, got ${colCount}.`;
                    l3SqlError.classList.add("active");
                    l3StockResponse.innerHTML = `<span style="color:var(--color-error)">Database UNION mismatch.</span>`;
                }
                return;
            }

            const fromUsers = cleanedInput.match(/FROM\s+users/i);
            if (fromUsers) {
                // Return users data!
                unionRows = window.mockDb.users.map(u => ({
                    store_id: "[UNION]",
                    product_id: u.username,
                    stock: u.password // stock count displays the password!
                }));
            } else {
                unionRows = [{ store_id: "[UNION]", product_id: "NULL", stock: 0 }];
            }
        }

        // Run normal stock check
        const baseStoreId = parseInt(cleanedInput);
        const stockRows = window.mockDb.stocks.filter(s => s.product_id === 1 && s.store_id === baseStoreId);
        
        results = [...stockRows, ...unionRows];

        if (isSilent) return;

        // Render response
        if (results.length === 0) {
            l3StockResponse.innerHTML = `Stock Level: <strong>0</strong> units`;
        } else if (isUnionAttack) {
            // Render the Union outputs!
            l3StockResponse.innerHTML = `<div style="font-family:var(--font-mono); font-size:12.5px; width:100%;">
                <div style="color:var(--color-success); border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:6px; margin-bottom:6px; font-weight:700;">UNION RESULTS RETRIEVED:</div>
                ${results.map(r => `<div>👤 User: <strong style="color:#fff">${r.product_id}</strong> | 🔑 Pass: <strong style="color:var(--color-warning)">${r.stock}</strong></div>`).join('')}
            </div>`;
        } else {
            l3StockResponse.innerHTML = `Stock Level in Store ${baseStoreId}: <strong>${results[0].stock}</strong> units`;
        }

        // Visual Database Grid
        renderDbTableVisual(l3DbTableBody, results, "stocks");

        // Check solve condition (successfully retrieved password of administrator)
        const retrievedAdminPass = results.some(r => r.stock === "p4ssw0rd_admin_secure_9921");
        if (retrievedAdminPass && !state.solvedLabs.lab3) {
            state.solvedLabs.lab3 = true;
            updateProgress();
            triggerSuccess("Lab Solved: XML WAF Bypass!", "Outstanding! You bypassed the WAF using XML hex entity encoding (<code>&amp;#x53;ELECT</code> instead of <code>SELECT</code>). The firewall saw no forbidden words, but the database received the decoded query and spilled the user accounts!", null);
        }
    }

    // ==========================================
    // Prevention Sandbox Logic
    // ==========================================
    const sandboxInput = document.getElementById("sandbox-input");
    const sandboxQueryVuln = document.getElementById("sandbox-query-vuln");
    const sandboxQuerySafe = document.getElementById("sandbox-query-safe");
    const sandboxOutputVuln = document.getElementById("sandbox-output-vuln");
    const sandboxOutputSafe = document.getElementById("sandbox-output-safe");
    const testSandboxBtn = document.getElementById("test-sandbox-btn");

    function initPreventionSandbox() {
        if (testSandboxBtn) {
            testSandboxBtn.addEventListener("click", () => {
                const val = sandboxInput.value;
                runSandboxTest(val);
            });
        }
        
        // Reset/init default
        runSandboxTest("Gifts' OR 1=1--");
    }

    function runSandboxTest(input) {
        // 1. Vulnerable (Concatenation) Query Construction & Logic
        const escHTML = str => str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const cleanInput = escHTML(input);

        // Highlight injection point in red
        const queryTemplateVuln = `<span class="sql-keyword">SELECT</span> * <span class="sql-keyword">FROM</span> <span class="sql-table">products</span> <span class="sql-keyword">WHERE</span> <span class="sql-column">category</span> = '<span class="sql-injection-input">${cleanInput}</span>' <span class="sql-keyword">AND</span> <span class="sql-column">released</span> = 1`;
        sandboxQueryVuln.innerHTML = queryTemplateVuln;

        // Run against database
        const dbRes = window.mockDb.queryCategory(input);
        if (!dbRes.success) {
            sandboxOutputVuln.innerHTML = `<span style="color:var(--color-error)">❌ ${dbRes.error}</span>`;
        } else {
            sandboxOutputVuln.innerHTML = `✅ Query Executed. Status: <strong>VULNERABLE SUCCESS</strong>.<br>Returned: <strong>${dbRes.rows.length} products</strong> (including unreleased: ${dbRes.rows.filter(r=>r.released===0).length}).`;
        }

        // 2. Safe (Parameterized) Query Construction & Logic
        // Parameterized query: SELECT * FROM products WHERE category = ? AND released = 1
        // Parameters: [input]
        sandboxQuerySafe.innerHTML = `
<span class="sql-keyword">PreparedStatement</span> stmt = conn.prepareStatement(
    "<span class="sql-keyword">SELECT</span> * <span class="sql-keyword">FROM</span> <span class="sql-table">products</span> <span class="sql-keyword">WHERE</span> <span class="sql-column">category</span> = <span style="color:var(--color-success)">?</span> <span class="sql-keyword">AND</span> <span class="sql-column">released</span> = 1"
);
stmt.setString(1, "<span class="sql-injection-input" style="background:rgba(16,185,129,0.15); border-color:var(--color-success); color:#a7f3d0;">${cleanInput}</span>");
        `.trim();

        // Parameterized execution treats the entire input strictly as a single string literal category name.
        // It does not evaluate comments, quote escaping, or operations.
        // It searches products where category = "Gifts' OR 1=1--" literally.
        const safeRows = window.mockDb.products.filter(p => p.category === input && p.released === 1);
        
        sandboxOutputSafe.innerHTML = `✅ Query Executed. Status: <strong>SECURE BLOCK</strong>.<br>Returned: <strong>${safeRows.length} products</strong>. (SQL compiler treated your payload as a literal string value, rendering the attack completely harmless).`;
    }

    // ==========================================
    // Visual Database Grid Renderers
    // ==========================================
    function renderDbTableVisual(container, activeRows, type) {
        if (!container) return;

        let headers = [];
        let rowsData = [];
        
        if (type === "products") {
            headers = ["id", "name", "category", "price", "released"];
            rowsData = window.mockDb.products.map(p => {
                const isActive = activeRows.some(ar => ar.id === p.id);
                return {
                    data: [p.id, p.name, p.category, `$${p.price}`, p.released],
                    isActive: isActive,
                    isInjected: isActive && p.released === 0
                };
            });
            
            // Add any union rows
            activeRows.forEach(ar => {
                if (ar.isUnion) {
                    rowsData.push({
                        data: [ar.id, ar.name, ar.category, `$${ar.price}`, ar.released],
                        isActive: true,
                        isInjected: true
                    });
                }
            });
        } else if (type === "users") {
            headers = ["id", "username", "password", "role"];
            rowsData = window.mockDb.users.map(u => {
                const isActive = activeRows.some(ar => ar.id === u.id);
                return {
                    data: [u.id, u.username, "••••••••", u.role],
                    isActive: isActive,
                    isInjected: isActive
                };
            });
        } else if (type === "stocks") {
            headers = ["product_id", "store_id", "stock"];
            rowsData = window.mockDb.stocks.map(s => {
                // Match stock rows
                const isActive = activeRows.some(ar => ar.product_id === s.product_id && ar.store_id === s.store_id);
                return {
                    data: [s.product_id, s.store_id, s.stock],
                    isActive: isActive,
                    isInjected: false
                };
            });
            // Add union rows
            activeRows.forEach(ar => {
                if (ar.store_id === "[UNION]") {
                    rowsData.push({
                        data: ["[UNION]", ar.product_id, ar.stock],
                        isActive: true,
                        isInjected: true
                    });
                }
            });
        }

        let html = `<table class="db-table"><thead><tr>`;
        headers.forEach(h => html += `<th>${h}</th>`);
        html += `</tr></thead><tbody>`;

        rowsData.forEach(r => {
            let trClass = "";
            if (r.isInjected) trClass = "row-injected";
            else if (r.isActive) trClass = "row-selected";
            
            html += `<tr class="${trClass}">`;
            r.data.forEach(d => html += `<td>${d}</td>`);
            html += `</tr>`;
        });

        html += `</tbody></table>`;
        container.innerHTML = html;
    }

    // ==========================================
    // Success / Solved Overlay and Confetti
    // ==========================================
    function triggerSuccess(title, message, nextRoute) {
        if (!successOverlay) return;
        
        successTitle.innerText = title;
        successMsg.innerHTML = message;
        successOverlay.classList.add("active");
        
        // Setup next route button
        if (nextRoute) {
            successNextBtn.innerText = `Advance to Next Lab ➡️`;
            successNextBtn.onclick = () => {
                navigate(nextRoute);
            };
        } else {
            successNextBtn.innerText = `Back to Dashboard 🏠`;
            successNextBtn.onclick = () => {
                navigate("home");
            };
        }

        // Start confetti
        startConfetti();
    }

    function closeSuccess() {
        if (successOverlay) {
            successOverlay.classList.remove("active");
        }
        stopConfetti();
    }

    // Confetti Animation Implementation
    function resizeConfettiCanvas() {
        if (confettiCanvas) {
            confettiCanvas.width = window.innerWidth;
            confettiCanvas.height = window.innerHeight;
        }
    }

    function startConfetti() {
        if (!confettiCtx) return;
        particles = [];
        for (let i = 0; i < 150; i++) {
            particles.push({
                x: Math.random() * confettiCanvas.width,
                y: Math.random() * confettiCanvas.height - confettiCanvas.height,
                r: Math.random() * 6 + 4,
                d: Math.random() * confettiCanvas.height,
                color: `hsl(${Math.random() * 360}, 90%, 60%)`,
                tilt: Math.random() * 10 - 5,
                tiltAngleIncremental: Math.random() * 0.07 + 0.02,
                tiltAngle: 0
            });
        }
        animateConfetti();
    }

    function animateConfetti() {
        confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
        let remaining = false;
        
        particles.forEach((p, idx) => {
            p.tiltAngle += p.tiltAngleIncremental;
            p.y += (Math.cos(p.d) + 3 + p.r / 2) / 2;
            p.x += Math.sin(p.tiltAngle);
            p.tilt = Math.sin(p.tiltAngle - idx / 3) * 15;
            
            if (p.y <= confettiCanvas.height) {
                remaining = true;
            }
            
            confettiCtx.beginPath();
            confettiCtx.lineWidth = p.r;
            confettiCtx.strokeStyle = p.color;
            confettiCtx.moveTo(p.x + p.tilt + p.r / 2, p.y);
            confettiCtx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 2);
            confettiCtx.stroke();
        });

        if (remaining) {
            confettiAnimationId = requestAnimationFrame(animateConfetti);
        }
    }

    function stopConfetti() {
        if (confettiAnimationId) {
            cancelAnimationFrame(confettiAnimationId);
            confettiAnimationId = null;
        }
        if (confettiCtx) {
            confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
        }
    }

    // Initialize UI (must run after all const DOM refs above are declared)
    initNavigation();
    initEli5Toggle();
    initLab1();
    initLab2();
    initLab3();
    initPreventionSandbox();
    updateProgress();
    resizeConfettiCanvas();

    window.addEventListener('resize', resizeConfettiCanvas);

    // Default renders
    renderAllGuides();
});
