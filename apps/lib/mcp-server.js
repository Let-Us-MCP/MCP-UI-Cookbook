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
    const fail = (code, message, data) => ({ jsonrpc: "2.0", id,
      error: { code, message, ...(data ? { data } : {}) } });

    const capabilities = {
      tools: { listChanged: false },
      resources: { listChanged: false },
      extensions: {
        "io.modelcontextprotocol/ui": { mimeTypes: [RESOURCE_MIME] },
      },
    };

    switch (method) {
      case "initialize": {
        // Echoing our own version at a client that asked for another one is
        // how a server looks like it agreed when it did not. The specification
        // gives the refusal a shape, and the point of the shape is that the
        // client learns what to retry with.
        const asked = params?.protocolVersion;
        if (asked !== undefined && asked !== PROTOCOL_VERSION) {
          return fail(-32022, "Unsupported protocol version",
            { supported: [PROTOCOL_VERSION], requested: asked });
        }
        return reply({
          protocolVersion: PROTOCOL_VERSION,
          serverInfo: { name, version },
          capabilities,
        });
      }

      // A client is allowed to ask what a server speaks before committing to
      // a version. Servers MUST answer, and none of these did.
      case "server/discover":
        return reply({
          resultType: "complete",
          supportedVersions: [PROTOCOL_VERSION],
          capabilities,
          _meta: { "io.modelcontextprotocol/serverInfo": { name, version } },
        });

      case "tools/list":
        return reply({ tools: descriptors });

      case "tools/call": {
        const tool = tools[params?.name];
        if (!tool) return fail(-32602, `Unknown tool: ${params?.name}`);
        // A tool may be async and may report progress while it runs. Progress
        // is a notification against the request that is running, so the token
        // comes off `_meta` exactly as core MCP defines it.
        const token = params?._meta?.progressToken;
        const notify = (method, notifyParams) => write(
          { jsonrpc: "2.0", method, params: notifyParams });
        const result = tool.run(params.arguments ?? {}, {
          progress: (progress, total, message) => {
            if (token === undefined) return;
            notify("notifications/progress",
              { progressToken: token, progress, total, message });
          },
          notify,
        });
        return result instanceof Promise
          ? result.then(reply)
          : reply(result);
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

  process.stdout.on("error", () => { /* the host went away mid-write */ });

  const write = (message) => {
    try {
      process.stdout.write(`${JSON.stringify(message)}\n`);
    } catch { /* the host went away mid-write */ }
  };

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
      if (response instanceof Promise) response.then((r) => r && write(r));
      else if (response) write(response);
    }
  });

  return { handle, descriptors };
}
