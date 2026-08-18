/* The forty lines every recipe server after the first one shares.
 *
 * Recipe 1 spells its server out in full, because you should see the whole
 * thing once. The other twelve differ only in their tools and their view, so
 * the rest is factored out here: the stdio framing, the initialize handshake
 * that declares the UI extension, and the resource read that returns the
 * view's HTML with its content security policy attached.
 */

import fs from "node:fs";

export const RESOURCE_MIME = "text/html;profile=mcp-app";
export const PROTOCOL_VERSION = "2026-07-28";

export function serve({ name, version = "1.0.0", resourceUri, viewFile,
                        tools = {}, resources = {}, ui = {} }) {
  const descriptors = Object.entries(tools).map(([toolName, tool]) => ({
    name: toolName,
    description: tool.description,
    inputSchema: tool.inputSchema ?? { type: "object" },
    annotations: tool.annotations,
    // The link from a tool to its view. Without this the tool is a normal
    // tool and the host renders text, which is the correct fallback.
    _meta: { ui: { resourceUri, visibility: tool.visibility ?? ["model", "app"] } },
  }));

  function handle({ id, method, params }) {
    const reply = (result) => ({ jsonrpc: "2.0", id, result });
    const fail = (code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });

    switch (method) {
      case "initialize":
        return reply({
          protocolVersion: PROTOCOL_VERSION,
          serverInfo: { name, version },
          capabilities: {
            tools: { listChanged: false },
            resources: { listChanged: false },
            extensions: {
              "io.modelcontextprotocol/ui": { mimeTypes: [RESOURCE_MIME] },
            },
          },
        });

      case "tools/list":
        return reply({ tools: descriptors });

      case "tools/call": {
        const tool = tools[params?.name];
        if (!tool) return fail(-32602, `Unknown tool: ${params?.name}`);
        return reply(tool.run(params.arguments ?? {}));
      }

      case "resources/list":
        return reply({ resources: [
          { uri: resourceUri, name, mimeType: RESOURCE_MIME,
            _meta: { ui: { prefersBorder: true, ...ui } } },
          ...Object.entries(resources).map(([uri, r]) => ({
            uri, name: r.name ?? uri, mimeType: r.mimeType ?? "text/plain" })),
        ] });

      case "resources/read": {
        if (params?.uri === resourceUri) {
          return reply({ contents: [{
            uri: resourceUri, mimeType: RESOURCE_MIME,
            text: fs.readFileSync(viewFile, "utf8"),
            // Declared empty on purpose: these views load nothing from the
            // network, so the host's restrictive default is exactly right.
            _meta: { ui: { csp: {}, prefersBorder: true, ...ui } },
          }] });
        }
        const extra = resources[params?.uri];
        if (!extra) return fail(-32002, `Resource not found: ${params?.uri}`);
        return reply({ contents: [{ uri: params.uri, ...extra }] });
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

  return { handle, descriptors };
}
