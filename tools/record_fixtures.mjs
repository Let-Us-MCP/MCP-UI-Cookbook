#!/usr/bin/env node
/* Record each recipe server's real answers into the fixture its demo uses.
 *
 * This is the join between the two halves of a recipe. The demo in the book
 * does not run the server, because a static site cannot. It answers from
 * `fixtures.json`, and this script produces that file by starting the actual
 * server over stdio and calling the actual tools listed in `record.json`.
 *
 * So the sentence the book makes is true: the view in the live pane receives
 * what the code in the server pane produces.
 *
 *   node tools/record_fixtures.mjs           # every recipe with a record.json
 *   node tools/record_fixtures.mjs r01-data-explorer
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const RECIPES = path.join(ROOT, "apps", "recipes");

function rpc(serverPath, calls) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [serverPath], {
      stdio: ["pipe", "pipe", "inherit"] });
    const answers = new Map();
    let buffer = "";
    let expected = calls.length + 1;

    child.stdout.on("data", (chunk) => {
      buffer += chunk;
      let index;
      while ((index = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, index).trim();
        buffer = buffer.slice(index + 1);
        if (!line) continue;
        const message = JSON.parse(line);
        answers.set(message.id, message);
        if (answers.size >= expected) {
          child.kill();
          resolve(answers);
        }
      }
    });
    child.on("error", reject);
    setTimeout(() => { child.kill(); reject(new Error("server timed out")); }, 8000);

    const write = (message) => child.stdin.write(`${JSON.stringify(message)}\n`);
    write({ jsonrpc: "2.0", id: 0, method: "initialize", params: {
      protocolVersion: "2026-07-28",
      clientInfo: { name: "fixture-recorder", version: "1.0.0" },
      capabilities: { extensions: {
        "io.modelcontextprotocol/ui": { mimeTypes: ["text/html;profile=mcp-app"] } } },
    } });
    calls.forEach((call, i) => write({
      jsonrpc: "2.0", id: i + 1, method: "tools/call",
      params: { name: call.tool, arguments: call.arguments ?? {} },
    }));
  });
}

const wanted = process.argv.slice(2);
let written = 0;

for (const dir of fs.readdirSync(RECIPES)) {
  if (wanted.length && !wanted.includes(dir)) continue;
  const recipe = path.join(RECIPES, dir);
  const plan = path.join(recipe, "record.json");
  const server = path.join(recipe, "server.js");
  if (!fs.existsSync(plan) || !fs.existsSync(server)) continue;

  const { calls } = JSON.parse(fs.readFileSync(plan, "utf8"));
  const answers = await rpc(server, calls);

  const fixtures = {
    recordedFrom: `apps/recipes/${dir}/server.js`,
    serverInfo: answers.get(0)?.result?.serverInfo,
    results: {},
  };
  calls.forEach((call, i) => {
    const answer = answers.get(i + 1);
    if (answer?.error) throw new Error(`${dir}/${call.tool}: ${answer.error.message}`);
    fixtures.results[call.as ?? call.tool] = answer.result;
  });

  fs.writeFileSync(path.join(recipe, "fixtures.json"),
    `${JSON.stringify(fixtures, null, 2)}\n`);
  console.log(`  ${dir}: ${calls.length} tool results recorded`);
  written += 1;
}

console.log(`${written} fixture files written from real servers`);
