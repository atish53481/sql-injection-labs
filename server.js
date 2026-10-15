// Minimal static web server for the SQL Injection lab (no dependencies)
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3002;
const HOST = "127.0.0.1";
const ROOT = __dirname;

const MIME = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".txt": "text/plain; charset=utf-8"
};

const server = http.createServer((req, res) => {
    let urlPath;
    try {
        urlPath = decodeURIComponent(new URL(req.url, `http://${HOST}`).pathname);
    } catch {
        res.writeHead(400).end("Bad request");
        return;
    }
    if (urlPath === "/") urlPath = "/index.html";

    // Resolve inside ROOT only (block path traversal)
    const filePath = path.join(ROOT, path.normalize(urlPath));
    if (!filePath.startsWith(ROOT + path.sep)) {
        res.writeHead(403).end("Forbidden");
        return;
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { "Content-Type": "text/plain" }).end("Not found");
            return;
        }
        const type = MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream";
        res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-cache" });
        res.end(data);
    });
});

server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
        console.error(`Port ${PORT} already in use - lab may already be running at http://localhost:${PORT}`);
    } else {
        console.error(err);
    }
    process.exit(1);
});

server.listen(PORT, HOST, () => {
    console.log(`SQL Injection Lab running at http://localhost:${PORT}`);
    console.log("Press Ctrl+C to stop.");
});
