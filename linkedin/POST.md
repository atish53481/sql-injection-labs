# LinkedIn Post

## Images (attach in this order)
1. `01-dashboard.png` — the training dashboard + lab catalog
2. `02-lab-exploit.png` — a UNION attack dumping credentials
3. `03-examine-db.png` — enumerating the database via information_schema

---

## Post text (copy from here)

🛡️ I built my own interactive SQL Injection training lab — and it taught me more than just reading about SQLi ever did.

Inspired by the PortSwigger Web Security Academy, I created a safe, fully self-contained sandbox to practice SQL injection end to end. Every database, user, and "vulnerability" is simulated, so there's zero risk — just a place to break queries and understand exactly WHY they break.

What's inside (10 hands-on labs so far 👇)
🔹 Retrieving hidden data (comment & tautology bypass)
🔹 Login bypass (subverting application logic)
🔹 WAF bypass using XML entity encoding
🔹 UNION attacks — column count, finding the text column, reading other tables, packing multiple values into one column
🔹 Examining the database — reading the version (Oracle & MySQL) and listing contents via information_schema

Each lab shows the live SQL query, the real result set, step-by-step hints, and a solve check — so you can see the attack AND the fix.

Biggest takeaway: once you've manually crafted a UNION payload and watched it pull an admin password out of a "hidden" table, parameterized queries stop being a checkbox and start being a reflex. Offense really does sharpen defense.

⚠️ Strictly for education. Never test these techniques on any system you don't own or lack written permission to assess — that's illegal.

Next up: blind SQL injection (conditional responses, error-based, time delays & OAST) and an advanced filter-bypass lab.

What topic should I build into a lab next? 👇

#CyberSecurity #SQLInjection #WebSecurity #EthicalHacking #AppSec #InfoSec #PentestingLearning #PortSwigger #SecurityResearch #LearningInPublic
