#!/usr/bin/env node
/* Everything the recipe servers publish, re-served through the reference
 * implementation and read back.
 *
 * `check_sdk_client.mjs` proves the servers answer a client nobody here wrote.
 * This asks the other half of the question: are the descriptors and results
 * they publish expressible in the reference implementation at all, and does
 * its own validation accept them unchanged?
 *
 * For each recipe it reads `tools/list`, `resources/list`, `resources/read`
 * and every read-only `tools/call` off the real server, registers exactly that
 * surface on the SDK's own `Server` over an in-memory transport, reads it back
 * through the SDK's `Client`, and compares field for field. The SDK validates
 * every result against its schemas on the way through, so a shape it rejects
 * fails here rather than in a reader's editor.
 *
 * What this does not do is compare two independent implementations. The
 * second server is built from the first one's output, so agreement on the
 * values is not evidence. What is evidence is that the reference
 * implementation accepts them, carries them unaltered, and validates them.
 *
 * Two things it found. `McpServer`, the SDK's high-level API, rejects a raw
 * JSON Schema `inputSchema` outright and demands Zod, so every schema printed
 * in this book has to be translated before it will run on that API. The
 * low-level `Server` takes them as published, which is why this uses it.
 *
 * Needs `proto/sdk-client/`, and skips cleanly without it.
 *
 *     node tools/check_differential.mjs
 *     node tools/check_differential.mjs r04-document-editor
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SDK = path.join(ROOT, "proto", "sdk-client", "node_modules",
  "@modelcontextprotocol", "sdk", "dist", "esm");
const RECIPES = path.join(ROOT, "apps", "recipes");
const PROTOCOL_VERSION = "2026-07-28";
const RESOURCE_MIME = "text/html;profile=mcp-app";

if (!fs.existsSync(SDK)) {
  console.log("proto/sdk-client absent, skipping the differential check");
  process.exit(0);
}

const load = (rel) => import(pathToFileURL(path.join(SDK, rel)).href);
const { Server } = await load("server/index.js");
const { Client } = await load("client/index.js");
const { StdioClientTransport } = await load("client/stdio.js");
const { InMemoryTransport } = await load("inMemory.js");
const T = await load("types.js");

const only = process.argv[2];
const recipes = fs.readdirSync(RECIPES).filter((d) => /^r\d\d-/.test(d))
  .filter((d) => !only || d === only).sort();

// Our own requests over the SDK's transport, because its Client will not
// finish a handshake at 2026-07-28. Same reason as check_sdk_client.mjs.
function raw(serverFile) {
  const transport = new StdioClientTransport(
    { command: process.execPath, args: [serverFile] });
  const pending = new Map();
  transport.onmessage = (message) => {
    const waiter = pending.get(message.id);
    if (waiter) { pending.delete(message.id); waiter(message); }
  };
  let id = 0;
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const messageId = ++id;
    pending.set(messageId, resolve);
    transport.send({ jsonrpc: "2.0", id: messageId, method, params }).catch(reject);
    setTimeout(() => reject(new Error(`${method} timed out`)), 10000);
  });
  return { transport, send };
}

const same = (a, b) => JSON.stringify(sortDeep(a)) === JSON.stringify(sortDeep(b));
function sortDeep(value) {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort()
      .map((k) => [k, sortDeep(value[k])]));
  }
  return value;
}

const problems = [];
let assertions = 0;
const check = (recipe, condition, detail) => {
  assertions += 1;
  if (!condition) problems.push(`${recipe}: ${detail}`);
};

for (const recipe of recipes) {
  const serverFile = path.join(RECIPES, recipe, "server.js");
  if (!fs.existsSync(serverFile)) continue;
  const { transport, send } = raw(serverFile);
  await transport.start();
  let mine = 0;
  try {
    await send("initialize", {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { extensions: { "io.modelcontextprotocol/ui": {} } },
      clientInfo: { name: "cookbook-differential", version: "1.0.0" },
    });
    const tools = (await send("tools/list", {})).result?.tools ?? [];
    const resources = (await send("resources/list", {})).result?.resources ?? [];
    const viewUri = tools[0]?._meta?.ui?.resourceUri;
    const view = (await send("resources/read", { uri: viewUri })).result;

    const results = new Map();
    for (const tool of tools) {
      if (!tool.annotations?.readOnlyHint) continue;
      const called = await send("tools/call", { name: tool.name, arguments: {} });
      if (called.result) results.set(tool.name, called.result);
    }
    await transport.close().catch(() => {});

    // Re-serve exactly that through the reference implementation.
    const mirror = new Server({ name: recipe, version: "1.0.0" }, {
      capabilities: {
        tools: { listChanged: false }, resources: { listChanged: false },
        extensions: {
          "io.modelcontextprotocol/ui": { mimeTypes: [RESOURCE_MIME] },
        },
      },
    });
    mirror.setRequestHandler(T.ListToolsRequestSchema, async () => ({ tools }));
    mirror.setRequestHandler(T.ListResourcesRequestSchema, async () => ({ resources }));
    mirror.setRequestHandler(T.ReadResourceRequestSchema, async () => view);
    mirror.setRequestHandler(T.CallToolRequestSchema, async (request) => {
      const result = results.get(request.params.name);
      if (!result) throw new Error(`no recorded result for ${request.params.name}`);
      return result;
    });

    const [serverEnd, clientEnd] = InMemoryTransport.createLinkedPair();
    const client = new Client(
      { name: "cookbook-differential", version: "1.0.0" }, { capabilities: {} });
    await Promise.all([mirror.connect(serverEnd), client.connect(clientEnd)]);

    // The SDK validates each of these against its own schemas on the way out.
    const backTools = (await client.listTools()).tools;
    check(recipe, same(backTools, tools),
      "tools/list did not survive the reference implementation unchanged");
    for (const tool of tools) {
      const back = backTools.find((t) => t.name === tool.name);
      check(recipe, same(back?._meta, tool._meta),
        `_meta on ${tool.name} was altered in transit`);
      check(recipe, same(back?.inputSchema, tool.inputSchema),
        `inputSchema on ${tool.name} was altered in transit`);
    }
    const backResources = (await client.listResources()).resources;
    check(recipe, same(backResources, resources),
      "resources/list did not survive unchanged");
    const backView = await client.readResource({ uri: viewUri });
    check(recipe, same(backView.contents, view.contents),
      "the view resource did not survive unchanged");
    for (const [name, result] of results) {
      const back = await client.callTool({ name, arguments: {} });
      check(recipe, same(back, result),
        `the result of ${name} did not survive unchanged`);
    }
    await client.close();
  } catch (error) {
    problems.push(`${recipe}: ${error.message}`);
  } finally {
    await transport.close().catch(() => {});
  }
  mine = problems.filter((p) => p.startsWith(`${recipe}:`)).length;
  console.log(`  ${recipe}: re-served through the reference implementation`
    + (mine ? `  FAILED (${mine})` : ""));
  for (const problem of problems.filter((p) => p.startsWith(`${recipe}:`))) {
    console.log(`      ${problem.slice(recipe.length + 2)}`);
  }
}

console.log(`${recipes.length} server(s), ${assertions} assertion(s) round `
  + `tripped through @modelcontextprotocol/sdk, ${problems.length} failing`);
process.exit(problems.length ? 1 : 0);
