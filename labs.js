// Lab Definitions, Checklists, and WAF Simulations

// Vocabulary definitions for tooltips
const VOCABULARY = {
    "sql": {
        title: "SQL (Structured Query Language)",
        desc: "The special language computers use to talk to databases and ask them to find, add, or delete information."
    },
    "database": {
        title: "Database",
        desc: "A digital filing cabinet where websites store all their information, like product lists, user profiles, and passwords."
    },
    "sqli": {
        title: "SQL Injection (SQLi)",
        desc: "A trick where an attacker sneaks database instructions into a normal website input, making the database run commands it shouldn't."
    },
    "query": {
        title: "SQL Query",
        desc: "A sentence written in SQL. For example, 'Show me all toys that cost less than $10'."
    },
    "waf": {
        title: "WAF (Web Application Firewall)",
        desc: "A digital guard dog that scans requests coming into a website and blocks them if they contain known bad words like 'SELECT' or 'UNION'."
    },
    "comment": {
        title: "SQL Comments (-- or #)",
        desc: "Symbols that tell the database: 'ignore everything written after this.' Attackers use this to slice off the security checks at the end of a query."
    },
    "union": {
        title: "UNION Operator",
        desc: "A SQL command used to stick two separate tables together, letting you read files from other cabinets (like the user accounts cabinet)."
    },
    "parameterized": {
        title: "Parameterized Query",
        desc: "A secure way of writing queries where user inputs are treated strictly as text, never as commands. Also called Prepared Statements."
    }
};

// Labs details and content
const LAB_CONFIGS = {
    "lab1": {
        id: "lab1",
        title: "Retrieving Hidden Data",
        subtitle: "Product category filter SQLi",
        difficulty: "Easy",
        goal: "Retrieve and display all products, including those that are unreleased (released = 0).",
        sqlTemplate: "SELECT * FROM products WHERE category = '[INPUT]' AND released = 1",
        
        // ELI5 Explanation
        eli5: `
            <div class="eli5-box">
                <h4><i class="icon-info"></i> ELI5 Analogy: The Tricked Librarian</h4>
                <p>Imagine the database is a library. You ask the librarian: <em>"Show me all 'Gifts' books that are approved for kids."</em></p>
                <p>Normally, you get back the approved books. But instead, you ask: <em>"Show me all 'Gifts' books... oh, and forget about the kid-approved rule!"</em></p>
                <p>By writing the special code <code>'--</code>, you tell the librarian to ignore the rest of the rule (the kid-approved check). The librarian gets confused, stops reading, and gives you <strong>every single book</strong> on the shelf, even the secret unreleased diaries!</p>
            </div>
        `,
        
        // Interactive Checklist
        steps: [
            { id: 1, text: "Try entering a single quote <code>'</code> in the filter to trigger a SQL syntax error." },
            { id: 2, text: "Enter <code>'--</code> to comment out the <code>released = 1</code> check and fetch unreleased products." },
            { id: 3, text: "Try a vanilla tautology bypass: <code>Gifts' OR 1=1--</code> to return all products from all categories!" }
        ]
    },
    
    "lab2": {
        id: "lab2",
        title: "Subverting Application Logic",
        subtitle: "Login bypass SQLi",
        difficulty: "Easy",
        goal: "Log in as the <strong>administrator</strong> user without knowing their password.",
        sqlTemplate: "SELECT * FROM users WHERE username = '[INPUT]' AND password = '[INPUT]'",
        
        // ELI5 Explanation
        eli5: `
            <div class="eli5-box">
                <h4><i class="icon-info"></i> ELI5 Analogy: The Magic Gatekeeper</h4>
                <p>Imagine a guard at a castle gate. The rule is: <em>"Let someone in if their name is 'administrator' AND they know the secret password."</em></p>
                <p>You walk up and say: <em>"My name is 'administrator'. Also, ignore the password rule."</em></p>
                <p>By typing <code>administrator'--</code>, you use the magic eraser <code>--</code> to wipe out the password requirement. The guard checks his list, sees 'administrator' is a valid name, forgets to check the password, and opens the gates!</p>
            </div>
        `,
        
        steps: [
            { id: 1, text: "Attempt to login as <code>administrator</code> with a random password to verify it fails." },
            { id: 2, text: "Inject a single quote into username <code>admin'</code> to see if a database error occurs." },
            { id: 3, text: "Enter <code>administrator'--</code> in the username field and leave the password blank to log in successfully!" }
        ]
    },
    
    "lab3": {
        id: "lab3",
        title: "Filter Bypass via XML Encoding",
        subtitle: "Stock check WAF bypass",
        difficulty: "Medium",
        goal: "Retrieve the usernames and passwords from the database by bypassing the Web Application Firewall (WAF) using XML entity encoding.",
        sqlTemplate: "SELECT stock FROM store_stocks WHERE product_id = 1 AND store_id = [INPUT]",
        
        // ELI5 Explanation
        eli5: `
            <div class="eli5-box">
                <h4><i class="icon-info"></i> ELI5 Analogy: The Secret Cipher</h4>
                <p>Imagine there is a strict guard at the door who checks your letters. If he sees the word <strong>"SELECT"</strong>, he tears up your letter and throws you in time-out.</p>
                <p>So, you write your letter in code. Instead of writing <strong>S</strong>, you write <strong>&#38;#x53;</strong> (which means 'S' in computer code). The guard looks at it, thinks it is gibberish, and lets it through.</p>
                <p>Inside the castle, the reader decodes the message back to <strong>SELECT</strong> and executes your request, successfully sneaking past the guard dog!</p>
            </div>
        `,
        
        steps: [
            { id: 1, text: "Send a normal stock check (click the button) and check the XML request payload." },
            { id: 2, text: "Try a simple SQL injection in <code>&lt;storeId&gt;</code>: <code>1 UNION SELECT username, password FROM users</code>. See the WAF block it!" },
            { id: 3, text: "Encode the keywords <code>UNION</code> and <code>SELECT</code> as XML entities, e.g. SELECT = <code>&amp;#x53;&amp;#x45;&amp;#x4c;&amp;#x45;&amp;#x43;&amp;#x54;</code> (or use the tool below). The WAF blocks both words." },
            { id: 4, text: "Send the bypass payload: <code>1 &amp;#x55;&amp;#x4e;&amp;#x49;&amp;#x4f;&amp;#x4e; &amp;#x53;&amp;#x45;&amp;#x4c;&amp;#x45;&amp;#x43;&amp;#x54; NULL, username, password, NULL, NULL, NULL FROM users--</code> and solve the lab!" }
        ]
    }
};

/**
 * Simulates Web Application Firewall (WAF) for Lab 3
 * Checks if query contains blacklisted SQL keywords in plain text.
 */
function checkWAF(xmlString) {
    // Look for plain SELECT or UNION keywords in raw XML
    const blacklist = [/SELECT/i, /UNION/i];
    
    for (let regex of blacklist) {
        if (regex.test(xmlString)) {
            const match = xmlString.match(regex)[0];
            return {
                blocked: true,
                reason: `Request blocked by Web Application Firewall (WAF): Suspicious SQL keyword '${match}' detected.`
            };
        }
    }
    
    return { blocked: false, reason: "WAF Verification Passed: No blacklisted keywords found in raw text." };
}

/**
 * Decodes XML numeric entities (e.g. &#x53; -> S, &#83; -> S)
 */
function decodeXmlEntities(str) {
    return str.replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => {
        return String.fromCharCode(parseInt(hex, 16));
    }).replace(/&#([0-9]+);/g, (match, dec) => {
        return String.fromCharCode(parseInt(dec, 10));
    });
}

/**
 * Encodes text to XML hex entities
 */
function encodeXmlHex(text) {
    return text.split('').map(c => `&#x${c.charCodeAt(0).toString(16)};`).join('');
}

// Make functions globally available
window.VOCABULARY = VOCABULARY;
window.LAB_CONFIGS = LAB_CONFIGS;
window.checkWAF = checkWAF;
window.decodeXmlEntities = decodeXmlEntities;
window.encodeXmlHex = encodeXmlHex;
console.log("Lab definitions and security controls loaded.");
