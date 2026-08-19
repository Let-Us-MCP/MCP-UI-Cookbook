#!/usr/bin/env node
/* Record the tool-to-view binding as it actually appears on the wire.
 *
 * Chapter 3 says a tool names its view through `_meta.ui.resourceUri` and that
 * the host reads it off the descriptor. That is a claim about JSON, so the
 * book should quote JSON, and the JSON should come from a server rather than
 * from an author's memory of one.
 *
 * This starts a recipe's real MCP server over stdio, performs the three
 * requests a host performs before anything is rendered, and writes the
 * answers to `conformance/wire/<recipe>.json`. The chapters quote that file
 * as an extracted listing, so `check_listings.py` verifies the quotation and
 * `make wire` verifies the file.
 *
 * Long fields are elided with a marker rather than truncated silently: a view
 * is thirty kilobytes of HTML and quoting it would teach nobody anything.
 *
 *   node tools/record_wire.mjs            # every recipe
 *   node tools/record_wire.mjs --check    # fail if any record is stale
 *   node tools/record_wire.mjs r01-data-explorer
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const RECIPES = path.join(ROOT, "apps", "recipes");
const OUT = path.join(ROOT, "conformance", "wire");

const PROTOCOL_VERSION = "2026-07-28";

function rpc(serverPath, requests) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [serverPath], {
      stdio: ["pipe", "pipe", "inherit"] });
    const answers = new Map();
    let buffer = "";

    child.stdout.on("data", (chunk) => {
      buffer += chunk;
      let index;
      while ((index = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, index).trim();
        buffer = buffer.slice(index + 1);
        if (!line) continue;
        const message = JSON.parse(line);
        answers.set(message.id, message);
        if (answers.size >= requests.length) {
          child.kill();
          resolve(answers);
        }
      }
    });
    child.on("error", reject);
    setTimeout(() => { child.kill(); reject(new Error("server timed out")); }, 8000);

    for (const request of requests) {
      child.stdin.write(`${JSON.stringify(request)}\n`);
    }
  });
}

// A view is tens of kilobytes. Say so instead of printing it.
//
// The marker is deliberately constant. Putting the exact length in it made
// every listing that quotes this file stale the moment anybody edited a view,
// which is churn without information. The length is recorded beside it, where
// nothing quotes it.
function elide(node) {
  if (Array.isArray(node)) return node.map(elide);
  if (node && typeof node === "object") {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      if (typeof v === "string" && v.length > 120) {
        out[k] = "<the view's HTML, elided>";
        out[`${k}Length`] = v.length;
      } else {
        out[k] = elide(v);
      }
    }
    return out;
  }
  return node;
}

const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const wanted = args.filter((a) => a !== "--check");
let written = 0;
const stale = [];

fs.mkdirSync(OUT, { recursive: true });

for (const dir of fs.readdirSync(RECIPES).sort()) {
  if (wanted.length && !wanted.includes(dir)) continue;
  const server = path.join(RECIPES, dir, "server.js");
  if (!fs.existsSync(server)) continue;

  const answers = await rpc(server, [
    { jsonrpc: "2.0", id: 0, method: "initialize", params: {
      protocolVersion: PROTOCOL_VERSION,
      clientInfo: { name: "wire-recorder", version: "1.0.0" },
      capabilities: { extensions: {
        "io.modelcontextprotocol/ui": { mimeTypes: ["text/html;profile=mcp-app"] } } },
    } },
    { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} },
    { jsonrpc: "2.0", id: 2, method: "resources/list", params: {} },
  ]);

  const tools = answers.get(1)?.result?.tools ?? [];
  const uri = tools[0]?._meta?.ui?.resourceUri;
  if (!uri) {
    console.error(`  ${dir}: no _meta.ui.resourceUri on any tool`);
    process.exitCode = 1;
    continue;
  }

  // Now read the resource the descriptor names, the way a host does.
  const read = await rpc(server, [
    { jsonrpc: "2.0", id: 0, method: "initialize", params: {
      protocolVersion: PROTOCOL_VERSION,
      clientInfo: { name: "wire-recorder", version: "1.0.0" },
      capabilities: {},
    } },
    { jsonrpc: "2.0", id: 1, method: "resources/read", params: { uri } },
  ]);

  const record = {
    note: "Recorded by tools/record_wire.mjs from the recipe's own server. "
        + "Regenerate with `make wire`.",
    "tools/list": elide(answers.get(1)),
    "resources/read": elide(read.get(1)),
  };

  const file = path.join(OUT, `${dir}.json`);
  const text = `${JSON.stringify(record, null, 2)}\n`;
  const before = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
  if (before !== text) {
    if (checkOnly) stale.push(dir);
    else { fs.writeFileSync(file, text); written += 1; }
  }
  console.log(`  ${dir}: ${tools.length} tool(s), bound to ${uri}`);
}

if (checkOnly) {
  for (const dir of stale) {
    console.error(`  ${dir}: wire record is stale; run \`make wire\``);
  }
  console.log(`${stale.length} stale wire record(s)`);
  if (stale.length) process.exitCode = 1;
} else {
  console.log(`${written} wire record(s) written`);
}
