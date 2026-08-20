#!/usr/bin/env node
/* Every recipe server, driven by a client nobody in this repository wrote.
 *
 * Chapter 27 calls this layer 5, and until now it was the largest hole in the
 * book's own verification: the emulator, the render driver and the servers
 * were written by one person, which is the condition under which a protocol
 * implementation looks more conformant than it is.
 *
 * This connects `@modelcontextprotocol/sdk` to each of the thirteen servers
 * over its own stdio transport and asserts on what comes back. It found two
 * things on its first run, both of them MUSTs in the pinned specification and
 * both absent from all thirteen servers.
 *
 * Needs `proto/sdk-client/`, which is never committed:
 *
 *     mkdir -p proto/sdk-client && cd proto/sdk-client
 *     npm install @modelcontextprotocol/sdk
 *
 * Skips cleanly without it, like the other specification checks.
 *
 *     node tools/check_sdk_client.mjs
 *     node tools/check_sdk_client.mjs r04-document-editor
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
  console.log("proto/sdk-client absent, skipping the SDK client check");
  process.exit(0);
}

const { Client } = await import(
  pathToFileURL(path.join(SDK, "client", "index.js")).href);
const { StdioClientTransport } = await import(
  pathToFileURL(path.join(SDK, "client", "stdio.js")).href);
const { LATEST_PROTOCOL_VERSION } = await import(
  pathToFileURL(path.join(SDK, "types.js")).href);

const only = process.argv[2];
const recipes = fs.readdirSync(RECIPES).filter((d) => /^r\d\d-/.test(d))
  .filter((d) => !only || d === only).sort();

// The SDK's own transport, but our own request, because the SDK client refuses
// to finish a handshake at a version it does not know and the questions below
// are about the server rather than about that refusal.
function raw(serverFile) {
  const transport = new StdioClientTransport(
    { command: process.execPath, args: [serverFile] });
  const pending = new Map();
  transport.onmessage = (message) => {
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    waiter(message);
  };
  let id = 0;
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const messageId = ++id;
    pending.set(messageId, resolve);
    transport.send({ jsonrpc: "2.0", id: messageId, method, params })
      .catch(reject);
    setTimeout(() => reject(new Error(`${method} timed out`)), 10000);
  });
  return { transport, send };
}

// JSON.stringify(undefined) is undefined, not a string, and a reporting line
// that throws hides the failure it was written to describe.
const brief = (value) => JSON.stringify(value ?? null)?.slice(0, 140) ?? "nothing";

const problems = [];
let assertions = 0;
const check = (name, condition, detail) => {
  assertions += 1;
  if (!condition) problems.push(`${name}: ${detail}`);
};

for (const recipe of recipes) {
  const serverFile = path.join(RECIPES, recipe, "server.js");
  if (!fs.existsSync(serverFile)) continue;
  const { transport, send } = raw(serverFile);
  await transport.start();
  try {
    // 1. The version the SDK actually ships must be refused, and refused in
    //    the shape the specification gives, or a client cannot tell a
    //    disagreement from a success.
    const refused = await send("initialize", {
      protocolVersion: LATEST_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "cookbook-sdk-check", version: "1.0.0" },
    });
    check(recipe, refused.error?.code === -32022,
      `initialize at ${LATEST_PROTOCOL_VERSION} answered `
      + `${brief(refused.error ?? refused.result)}, `
      + "expected an UnsupportedProtocolVersionError");
    check(recipe, refused.error?.data?.supported?.includes(PROTOCOL_VERSION),
      `the refusal did not name ${PROTOCOL_VERSION} as supported`);
    check(recipe, refused.error?.data?.requested === LATEST_PROTOCOL_VERSION,
      "the refusal did not echo the version that was requested");

    // 2. server/discover is a MUST, and is how a client learns the above
    //    without guessing.
    const discovered = await send("server/discover", {});
    check(recipe, discovered.result?.supportedVersions?.includes(PROTOCOL_VERSION),
      `server/discover answered ${brief(discovered.error ?? discovered.result)}`);
    check(recipe,
      discovered.result?.capabilities?.extensions?.["io.modelcontextprotocol/ui"],
      "server/discover did not advertise the UI extension");

    // 3. At the version it does support, the handshake completes and the
    //    extension is declared.
    const init = await send("initialize", {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { extensions: { "io.modelcontextprotocol/ui": {} } },
      clientInfo: { name: "cookbook-sdk-check", version: "1.0.0" },
    });
    check(recipe, init.result?.protocolVersion === PROTOCOL_VERSION,
      `initialize answered ${brief(init.error ?? init.result)}`);
    const ui = init.result?.capabilities?.extensions?.["io.modelcontextprotocol/ui"];
    check(recipe, ui?.mimeTypes?.includes(RESOURCE_MIME),
      "initialize did not declare the UI extension with its mime type");

    // 4. Every tool points at a view, and that view is readable as a resource.
    const listed = await send("tools/list", {});
    const tools = listed.result?.tools ?? [];
    check(recipe, tools.length > 0, "tools/list returned nothing");
    for (const tool of tools) {
      check(recipe, typeof tool._meta?.ui?.resourceUri === "string",
        `tool ${tool.name} carries no _meta.ui.resourceUri`);
    }
    const uri = tools[0]?._meta?.ui?.resourceUri;
    const read = await send("resources/read", { uri });
    const content = read.result?.contents?.[0];
    check(recipe, content?.mimeType === RESOURCE_MIME,
      `resources/read on ${uri} gave mimeType ${content?.mimeType}`);
    check(recipe, typeof content?.text === "string" && content.text.includes("<"),
      `resources/read on ${uri} returned no markup`);

    // 5. A missing resource errors, and does not error with -32002, which
    //    this protocol version retired and forbids emitting.
    const missing = await send("resources/read",
      { uri: "file:///workspace/does-not-exist" });
    check(recipe, missing.error !== undefined,
      `resources/read on a missing uri answered ${brief(missing.result)}`);
    check(recipe, missing.error?.code !== -32002,
      "resources/read emitted -32002, which 2026-07-28 forbids; use -32602");
    check(recipe, missing.result?.contents === undefined,
      "a missing resource came back with a contents array");

    // 6. The read-only tools answer, and answer with something in them.
    for (const tool of tools) {
      if (!tool.annotations?.readOnlyHint) continue;
      const called = await send("tools/call", { name: tool.name, arguments: {} });
      const result = called.result;
      check(recipe, result !== undefined,
        `tools/call ${tool.name} errored: ${brief(called.error)}`);
      check(recipe,
        (result?.content?.length ?? 0) > 0 || result?.structuredContent !== undefined,
        `tools/call ${tool.name} returned neither content nor structuredContent`);
    }
  } catch (error) {
    problems.push(`${recipe}: ${error.message}`);
  } finally {
    await transport.close().catch(() => {});
  }
  const mine = problems.filter((p) => p.startsWith(`${recipe}:`));
  console.log(`  ${recipe}: driven by the real SDK transport`
    + (mine.length ? `  FAILED (${mine.length})` : ""));
  for (const problem of mine) console.log(`      ${problem.slice(recipe.length + 2)}`);
}

console.log(`${recipes.length} server(s), ${assertions} assertion(s) against `
  + `@modelcontextprotocol/sdk, ${problems.length} failing`);
process.exit(problems.length ? 1 : 0);
