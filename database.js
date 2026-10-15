// Simulated Database and Query Engine

// Initial Database State
const DB_PRODUCTS = [
    { id: 1, name: "Cybersecurity Shield", category: "Gifts", price: 29.99, released: 1, image: "🛡️" },
    { id: 2, name: "Hacker's Black Hoodie", category: "Gifts", price: 49.99, released: 1, image: "🧥" },
    { id: 3, name: "Super Secret Exploit (Zero Day)", category: "Gifts", price: 999.99, released: 0, image: "☣️" }, // UNRELEASED!
    { id: 4, name: "Squeaky Rubber Duck", category: "Pets", price: 9.99, released: 1, image: "🦆" },
    { id: 5, name: "Laser Cat Toy Pointer", category: "Pets", price: 14.99, released: 1, image: "🐈" },
    { id: 6, name: "Untamable Cyber Dragon", category: "Pets", price: 8888.88, released: 0, image: "🐉" }, // UNRELEASED!
    { id: 7, name: "Mechanical Keyboard (Blue Switches)", category: "Tech", price: 89.99, released: 1, image: "⌨️" },
    { id: 8, name: "Infinite Coffee Mug", category: "Tech", price: 19.99, released: 1, image: "☕" },
    { id: 9, name: "Supercomputer Time Machine", category: "Tech", price: 99999.00, released: 0, image: "⏳" } // UNRELEASED!
];

const DB_USERS = [
    { id: 1, username: "administrator", password: "p4ssw0rd_admin_secure_9921", role: "Administrator" },
    { id: 2, username: "wiener", password: "bluecheese", role: "Standard User" },
    { id: 3, username: "carlos", password: "montoya", role: "Standard User" }
];

const DB_STOCKS = [
    { product_id: 1, store_id: 1, stock: 45 },
    { product_id: 1, store_id: 2, stock: 12 },
    { product_id: 2, store_id: 1, stock: 8 },
    { product_id: 3, store_id: 1, stock: 1 }, // Hidden item
    { product_id: 4, store_id: 1, stock: 102 },
    { product_id: 5, store_id: 2, stock: 3 }
];

class MockDatabase {
    constructor() {
        this.products = [...DB_PRODUCTS];
        this.users = [...DB_USERS];
        this.stocks = [...DB_STOCKS];
    }

    /**
     * Simulates SQL Category filtering
     * Template: SELECT * FROM products WHERE category = '${category}' AND released = 1
     */
    queryCategory(input) {
        const queryTemplate = `SELECT * FROM products WHERE category = '${input}' AND released = 1`;
        let activeQuery = queryTemplate;
        let isCommented = false;
        let commentContent = "";

        // 1. Handle Comments: Strip everything after -- or #
        const commentMatch = input.match(/(--|#)/);
        if (commentMatch) {
            isCommented = true;
            const index = input.indexOf(commentMatch[0]);
            const activeInput = input.substring(0, index);
            commentContent = input.substring(index);
            // Construct active query up to the comment without adding a trailing quote
            activeQuery = `SELECT * FROM products WHERE category = '${activeInput}`;
        }

        // 2. Quote Balance Check (in the active portion)
        // Count total single quotes in the constructed query.
        // SQL will throw a syntax error if quotes are unbalanced.
        const quoteCount = (activeQuery.match(/'/g) || []).length;
        if (quoteCount % 2 !== 0) {
            return {
                success: false,
                error: "SQL Syntax Error: Unclosed quotation mark after character string. Near: " + activeQuery.slice(-15),
                queryText: activeQuery,
                highlightedQuery: this.highlightSQL(queryTemplate, input, isCommented, commentContent),
                rows: []
            };
        }

        // 3. Parse conditions (extremely basic evaluator for simulation purposes)
        // Extract the value inside the single quotes of the category, and any trailing injection clause
        let categoryVal = "";
        let hasOrAlwaysTrue = false;
        let hasUnion = false;
        let unionDetails = null;

        // Cleaned input (without comments)
        const cleanedInput = isCommented ? input.split(/--|#/)[0] : input;

        // Check for UNION SELECT
        const unionMatch = cleanedInput.match(/UNION\s+SELECT\s+(.+)/i);
        if (unionMatch) {
            hasUnion = true;
            const unionBody = unionMatch[1].trim();
            // Count expressions separated by commas
            const expressions = unionBody.split(',').map(e => e.trim());
            
            // Check if columns match products (6 columns)
            if (expressions.length !== 6) {
                return {
                    success: false,
                    error: `SQL Server Error: All queries combined using a UNION, INTERSECT or EXCEPT operator must have an equal number of expressions in their target lists. Expected 6 columns, got ${expressions.length}.`,
                    queryText: activeQuery,
                    highlightedQuery: this.highlightSQL(queryTemplate, input, isCommented, commentContent),
                    rows: []
                };
            }

            // Check if expressions reference users table
            const fromUsers = cleanedInput.match(/FROM\s+users/i);
            
            unionDetails = {
                expressions: expressions,
                fromUsers: !!fromUsers
            };
        }

        // Check if there is an OR 1=1 or similar tautology
        // Regex to check OR followed by boolean equations like 1=1, 'a'='a', etc.
        const orPattern = /\s+OR\s+(\d+)\s*=\s*\1/i;
        const orStrPattern = /\s+OR\s+'([^']*)'\s*=\s*'\1'/i;
        if (orPattern.test(cleanedInput) || orStrPattern.test(cleanedInput)) {
            hasOrAlwaysTrue = true;
        }

        // Determine base category
        const firstQuoteIndex = cleanedInput.indexOf("'");
        if (firstQuoteIndex === -1) {
            // Standard input
            categoryVal = cleanedInput.trim();
        } else {
            categoryVal = cleanedInput.substring(0, firstQuoteIndex).trim();
        }

        // Execute simulation filter
        let results = [];
        
        if (hasOrAlwaysTrue) {
            // Returns ALL products regardless of category or released state (since it bypassed the released=1 constraint)
            results = [...this.products];
        } else {
            // Normal filtering
            results = this.products.filter(p => {
                const categoryMatch = p.category.toLowerCase() === categoryVal.toLowerCase();
                // If comment was used, we stripped the "AND released = 1" check!
                if (isCommented) {
                    return categoryMatch;
                } else {
                    return categoryMatch && p.released === 1;
                }
            });
        }

        // Handle UNION results merge
        if (hasUnion && unionDetails) {
            // If they are pulling columns from users table
            if (unionDetails.fromUsers) {
                // Map user entries to products structure
                // Products columns: id, name, category, price, released, image
                // Suppose they mapped: NULL, username, password, NULL, NULL, NULL
                // expressions might be: NULL, username, password, NULL, etc. or specific values.
                
                const userUnionRows = this.users.map(u => {
                    const row = { id: "[UNION Row]", name: "", category: "UNION DATA", price: 0, released: 1, image: "🔑", isUnion: true };
                    
                    // Fill row columns based on expressions index
                    unionDetails.expressions.forEach((expr, idx) => {
                        const val = expr.toLowerCase();
                        let cellVal = null;
                        if (val === 'username') cellVal = u.username;
                        else if (val === 'password') cellVal = u.password;
                        else if (val === 'role') cellVal = u.role;
                        else if (val.startsWith("'") && val.endsWith("'")) cellVal = expr.slice(1, -1); // Literal string
                        else if (val === 'null') cellVal = "NULL";
                        else cellVal = expr; // Default to literal text

                        if (idx === 1) row.name = cellVal;
                        else if (idx === 2) row.category = cellVal;
                        else if (idx === 3) row.price = isNaN(parseFloat(cellVal)) ? 0 : parseFloat(cellVal);
                        else if (idx === 4) row.released = 1;
                    });
                    
                    return row;
                });
                
                results = [...results, ...userUnionRows];
            } else {
                // Union not pulling from users, return placeholders
                const emptyUnionRows = [1, 2].map(i => {
                    const row = { id: "[UNION Row]", name: "NULL", category: "NULL", price: 0, released: 1, image: "🥚", isUnion: true };
                    unionDetails.expressions.forEach((expr, idx) => {
                        let cellVal = expr;
                        if (expr.toLowerCase() === 'null') cellVal = "NULL";
                        if (idx === 1) row.name = cellVal;
                        else if (idx === 2) row.category = cellVal;
                    });
                    return row;
                });
                results = [...results, ...emptyUnionRows];
            }
        }

        return {
            success: true,
            error: null,
            queryText: activeQuery,
            highlightedQuery: this.highlightSQL(queryTemplate, input, isCommented, commentContent),
            rows: results
        };
    }

    /**
     * Simulates SQL Login Bypass
     * Template: SELECT * FROM users WHERE username = '${username}' AND password = '${password}'
     */
    queryLogin(username, password) {
        const queryTemplate = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;
        let activeQuery = queryTemplate;
        let isCommented = false;
        let commentContent = "";

        // 1. Comments Check on Username
        const commentMatch = username.match(/(--|#)/);
        if (commentMatch) {
            isCommented = true;
            const index = username.indexOf(commentMatch[0]);
            const activeUser = username.substring(0, index);
            commentContent = username.substring(index);
            // Construct active query up to the comment without adding a trailing quote
            activeQuery = `SELECT * FROM users WHERE username = '${activeUser}`;
        }

        // 2. Quote Balance Check
        const quoteCount = (activeQuery.match(/'/g) || []).length;
        if (quoteCount % 2 !== 0) {
            return {
                success: false,
                error: "SQL Syntax Error: Unclosed quotation mark before character string. Near: " + activeQuery.slice(-15),
                queryText: activeQuery,
                highlightedQuery: this.highlightSQL(queryTemplate, username, isCommented, commentContent, password),
                user: null
            };
        }

        // 3. Evaluate Authentication
        let authenticatedUser = null;
        const cleanedUser = isCommented ? username.split(/--|#/)[0] : username;

        // Check if username field contains an OR tautology like ' OR 1=1--
        const orPattern = /\s+OR\s+(\d+)\s*=\s*\1/i;
        const orStrPattern = /\s+OR\s+'([^']*)'\s*=\s*'\1'/i;
        const hasOrBypass = orPattern.test(cleanedUser) || orStrPattern.test(cleanedUser);

        // Find administrator check
        const targetUsername = cleanedUser.replace(/'/g, "").trim();

        if (isCommented) {
            // Password check is commented out!
            // Match username only
            if (hasOrBypass) {
                // Logs in as first user (administrator usually)
                authenticatedUser = this.users[0];
            } else {
                authenticatedUser = this.users.find(u => u.username.toLowerCase() === targetUsername.toLowerCase()) || null;
            }
        } else {
            // Normal login checking both username and password
            // Note: even if username has ' OR 1=1, if not commented, password check is still required
            // but wait, if username contains ' OR 1=1' OR 'a'='a, it could bypass
            authenticatedUser = this.users.find(u => {
                const userMatch = u.username.toLowerCase() === username.toLowerCase();
                const passMatch = u.password === password;
                return userMatch && passMatch;
            }) || null;
        }

        return {
            success: true,
            error: null,
            queryText: activeQuery,
            highlightedQuery: this.highlightSQL(queryTemplate, username, isCommented, commentContent, password),
            user: authenticatedUser
        };
    }

    /**
     * Highlight SQL query for rendering on UI
     */
    highlightSQL(template, inputVal, isCommented, commentVal = "", secondInput = null) {
        // We'll generate HTML content
        // Highlight normal keywords
        const keywords = ["SELECT", "FROM", "WHERE", "AND", "OR", "UNION", "NULL"];
        
        let formatted = template;
        
        // Escape HTML
        const escapeHTML = str => str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        
        if (secondInput !== null) {
            // Login query
            // SELECT * FROM users WHERE username = '${username}' AND password = '${password}'
            const escUser = escapeHTML(inputVal);
            const escPass = escapeHTML(secondInput);
            
            let queryPart = "";
            let commentPart = "";
            
            if (isCommented) {
                // Highlight input and grey out comment
                const index = escUser.indexOf(escapeHTML(commentVal));
                const activeInput = escUser.substring(0, index);
                const commentText = escUser.substring(index);
                
                queryPart = `<span class="sql-keyword">SELECT</span> * <span class="sql-keyword">FROM</span> <span class="sql-table">users</span> <span class="sql-keyword">WHERE</span> <span class="sql-column">username</span> = '<span class="sql-injection-input">${activeInput}</span>`;
                commentPart = `<span class="sql-injection-comment">${commentText}' AND password = '${escPass}'</span>`;
            } else {
                queryPart = `<span class="sql-keyword">SELECT</span> * <span class="sql-keyword">FROM</span> <span class="sql-table">users</span> <span class="sql-keyword">WHERE</span> <span class="sql-column">username</span> = '<span class="sql-injection-input">${escUser}</span>' <span class="sql-keyword">AND</span> <span class="sql-column">password</span> = '<span class="sql-injection-input">${escPass}</span>'`;
            }
            
            return queryPart + commentPart;
        } else {
            // Category query
            // SELECT * FROM products WHERE category = '${category}' AND released = 1
            const escInput = escapeHTML(inputVal);
            let queryPart = "";
            let commentPart = "";
            
            if (isCommented) {
                const index = escInput.indexOf(escapeHTML(commentVal));
                const activeInput = escInput.substring(0, index);
                const commentText = escInput.substring(index);
                
                queryPart = `<span class="sql-keyword">SELECT</span> * <span class="sql-keyword">FROM</span> <span class="sql-table">products</span> <span class="sql-keyword">WHERE</span> <span class="sql-column">category</span> = '<span class="sql-injection-input">${activeInput}</span>`;
                commentPart = `<span class="sql-injection-comment">${commentText}' AND released = 1</span>`;
            } else {
                queryPart = `<span class="sql-keyword">SELECT</span> * <span class="sql-keyword">FROM</span> <span class="sql-table">products</span> <span class="sql-keyword">WHERE</span> <span class="sql-column">category</span> = '<span class="sql-injection-input">${escInput}</span>' <span class="sql-keyword">AND</span> <span class="sql-column">released</span> = 1`;
            }
            
            return queryPart + commentPart;
        }
    }
}

// Export database class for ESM usage (or expose to window if simple script)
window.mockDb = new MockDatabase();
console.log("Mock database initialized.");
