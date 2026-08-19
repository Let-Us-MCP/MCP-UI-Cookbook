#!/usr/bin/env node
/* The Data Explorer's MCP server: about 120 lines, no dependencies.
 *
 * It does the four things an MCP Apps server has to do. It declares that it
 * speaks the UI extension, it registers a `ui://` resource whose content is
 * the view, it registers tools that point at that resource through
 * `_meta.ui.resourceUri`, and it returns results that are useful to a model
 * in `content` and useful to a view in `structuredContent`.
 *
 * Run it with a stdio MCP client:  node apps/recipes/r01-data-explorer/server.js
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROTOCOL_VERSION = "2026-07-28";
const RESOURCE_URI = "ui://cookbook/data-explorer";
const RESOURCE_MIME = "text/html;profile=mcp-app";

const DEPLOYMENTS = [
  { id: "d1", service: "checkout", env: "production", version: "4.18.2",
    p95: 412, errors: 17, at: "2026-08-17T09:12:00Z" },
  { id: "d2", service: "checkout", env: "canary", version: "4.19.0-rc1",
    p95: 388, errors: 2, at: "2026-08-18T06:40:00Z" },
  { id: "d3", service: "search", env: "production", version: "2.7.11",
    p95: 96, errors: 0, at: "2026-08-15T14:03:00Z" },
  { id: "d4", service: "search", env: "staging", version: "2.8.0",
    p95: 104, errors: 1, at: "2026-08-18T08:21:00Z" },
  { id: "d5", service: "billing", env: "production", version: "9.2.4",
    p95: 1290, errors: 143, at: "2026-08-16T22:55:00Z" },
  { id: "d6", service: "billing", env: "staging", version: "9.3.0",
    p95: 502, errors: 4, at: "2026-08-18T07:02:00Z" },
  { id: "d7", service: "notifications", env: "production", version: "1.14.0",
    p95: 233, errors: 6, at: "2026-08-14T11:30:00Z" },
  { id: "d8", service: "notifications", env: "canary", version: "1.15.0-rc2",
    p95: 219, errors: 0, at: "2026-08-18T05:15:00Z" },
];

const summarise = (rows) => rows.length
  ? `${rows.length} deployments. Worst p95 is ${
      Math.max(...rows.map((r) => r.p95))}ms on ${
      rows.reduce((a, b) => (a.p95 > b.p95 ? a : b)).service}.`
  : "No deployments match.";

const TOOLS = {
  list_deployments: {
    descriptor: {
      name: "list_deployments",
      title: "List deployments",
      description: "List recent deployments with latency and error counts.",
      inputSchema: {
        type: "object",
        properties: {
          env: { type: "string", enum: ["production", "staging", "canary"] },
        },
      },
      annotations: { readOnlyHint: true },
      _meta: { ui: { resourceUri: RESOURCE_URI, visibility: ["model", "app"] } },
    },
    run: ({ env } = {}) => {
      const rows = env ? DEPLOYMENTS.filter((d) => d.env === env) : DEPLOYMENTS;
      return {
        // The model reads this. It is a sentence, not a table dump, because a
        // table dump in the context window is a table the model has to parse
        // and the view is about to render anyway.
        content: [{ type: "text", text: summarise(rows) }],
        // The view reads this. It never reaches the model.
        structuredContent: { deployments: rows },
      };
    },
  },

  explain_deployment: {
    descriptor: {
      name: "explain_deployment",
      description: "Fetch the change log for one deployment.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
      annotations: { readOnlyHint: true },
      _meta: { ui: { resourceUri: RESOURCE_URI, visibility: ["model", "app"] } },
    },
    run: ({ id }) => {
      const row = DEPLOYMENTS.find((d) => d.id === id);
      if (!row) {
        return { isError: true,
                 content: [{ type: "text", text: `No deployment ${id}.` }] };
      }
      return {
        content: [{ type: "text", text:
          `${row.service} ${row.version} went to ${row.env} on ${row.at}. ` +
          `p95 ${row.p95}ms, ${row.errors} errors in the first hour.` }],
        structuredContent: { deployment: row },
      };
    },
  },
};

const RESOURCES = {
  [RESOURCE_URI]: () => ({
    uri: RESOURCE_URI,
    mimeType: RESOURCE_MIME,
    text: fs.readFileSync(path.join(HERE, "index.html"), "utf8"),
    _meta: {
      ui: {
        // Declared narrowly on purpose. The view loads nothing from the
        // network, so the default restrictive policy is exactly right and
        // anything wider would be a lie the host has to enforce.
        csp: {},
        prefersBorder: true,
      },
    },
  }),
};

function handle(message) {
  const { id, method, params } = message;
  const reply = (result) => ({ jsonrpc: "2.0", id, result });
  const fail = (code, msg, data) => ({ jsonrpc: "2.0", id,
    error: { code, message: msg, ...(data ? { data } : {}) } });

  const CAPABILITIES = {
    tools: { listChanged: false },
    resources: { listChanged: false },
    extensions: {
      "io.modelcontextprotocol/ui": { mimeTypes: [RESOURCE_MIME] },
    },
  };

  switch (method) {
    case "initialize": {
      // Echoing our own version at a client that asked for another one is how
      // a server looks like it agreed when it did not. The refusal has a
      // shape so the client learns what to retry with.
      const asked = params?.protocolVersion;
      if (asked !== undefined && asked !== PROTOCOL_VERSION) {
        return fail(-32022, "Unsupported protocol version",
          { supported: [PROTOCOL_VERSION], requested: asked });
      }
      return reply({
        protocolVersion: PROTOCOL_VERSION,
        serverInfo: { name: "cookbook-data-explorer", version: "1.0.0" },
        capabilities: CAPABILITIES,
      });
    }

    // A client may ask what a server speaks before committing to a version.
    // Servers MUST answer.
    case "server/discover":
      return reply({
        resultType: "complete",
        supportedVersions: [PROTOCOL_VERSION],
        capabilities: CAPABILITIES,
        _meta: { "io.modelcontextprotocol/serverInfo": {
          name: "cookbook-data-explorer", version: "1.0.0" } },
      });

    case "tools/list":
      return reply({ tools: Object.values(TOOLS).map((t) => t.descriptor) });

    case "tools/call": {
      const tool = TOOLS[params?.name];
      if (!tool) return fail(-32602, `Unknown tool: ${params?.name}`);
      return reply(tool.run(params.arguments ?? {}));
    }

    case "resources/list":
      return reply({ resources: [{
        uri: RESOURCE_URI, name: "data_explorer",
        description: "Interactive deployment table",
        mimeType: RESOURCE_MIME,
        _meta: { ui: { prefersBorder: true } },
      }] });

    case "resources/read": {
      const make = RESOURCES[params?.uri];
      if (!make) return fail(-32002, `Resource not found: ${params?.uri}`);
      return reply({ contents: [make()] });
    }

    case "ping":
      return reply({});

    default:
      if (method?.startsWith("notifications/")) return null;
      return fail(-32601, `Method not found: ${method}`);
  }
}

let buffer = "";
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let index;
  while ((index = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, index).trim();
    buffer = buffer.slice(index + 1);
    if (!line) continue;
    let response;
    try {
      response = handle(JSON.parse(line));
    } catch (error) {
      response = { jsonrpc: "2.0", id: null,
                   error: { code: -32700, message: String(error.message) } };
    }
    if (response) process.stdout.write(`${JSON.stringify(response)}\n`);
  }
});

export { TOOLS, RESOURCES, handle };
