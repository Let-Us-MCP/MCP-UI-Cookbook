#!/usr/bin/env node
/* Static file server for docs/. Used by `make serve` and by the demo checker.
 * GitHub Pages serves the same bytes; this exists so the same bytes can be
 * driven by a browser before they are pushed. */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(
  path.dirname(path.dirname(fileURLToPath(import.meta.url))), "docs");
const PORT = Number(process.env.PORT || 8977);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);
  let file = path.join(ROOT, url);
  if (!file.startsWith(ROOT)) {
    res.writeHead(403).end("forbidden");
    return;
  }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    file = path.join(file, "index.html");
  }
  if (!fs.existsSync(file)) {
    res.writeHead(404, { "content-type": "text/plain" }).end("not found");
    return;
  }
  res.writeHead(200, {
    "content-type": TYPES[path.extname(file)] || "application/octet-stream",
    "cache-control": "no-store",
  });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => {
  if (process.env.QUIET !== "1") {
    console.log(`docs/ on http://127.0.0.1:${PORT}/`);
  }
});
