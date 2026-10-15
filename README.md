# SQL Injection Labs

Local, dependency-free SQL injection training platform modeled on the PortSwigger Web Security Academy SQLi labs. Runs entirely in the browser with a simulated database — no real DB required.

## Run

```bash
node server.js
```

Then open http://localhost:3002 (or double-click `Start.bat` on Windows).

## Files

- `server.js` — minimal static web server (port 3002, bound to 127.0.0.1)
- `index.html`, `styles.css` — lab dashboard UI
- `database.js` — simulated vulnerable query engine
- `labs.js`, `sqli-labs-ext.js` — lab definitions (WHERE bypass, login bypass, UNION attacks, ...)
- `Notes.docx` — study notes

> For education only. Intentionally vulnerable — keep it on localhost.
