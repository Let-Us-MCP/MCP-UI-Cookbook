// The host half of the MCP Apps bridge.
//
// A real host is a chat client with a model behind it. This one is about two
// hundred lines and has a fixture file behind it instead. Everything else is
// the same: it owns the iframe, it answers `ui/initialize`, it decides what
// the view is allowed to do, and it is the only party that can talk to the
// server.
//
// The fixtures it answers from are recorded by running the recipe's real MCP
// server in CI, so the view in the live pane receives exactly what the code
// in the code pane produces.

const PROTOCOL_VERSION = "2026-07-28";

export class HostEmulator {
  constructor(frame, config = {}, onMessage = () => {}) {
    this.frame = frame;
    this.config = config;
    this.onMessage = onMessage;

    this.hostInfo = config.hostInfo ?? { name: "cookbook-emulator", version: "1.0.0" };
    this.hostCapabilities = config.hostCapabilities ?? {};
    this.hostContext = { displayMode: "inline", ...(config.hostContext ?? {}) };
    this.appCapabilities = null;
    this.appInfo = null;
    this.initialized = false;

    this._id = 0;
    this._pending = new Map();
    this._modelContext = null;
    this._log = [];

    this._listener = (event) => {
      if (event.source !== this.frame.contentWindow) return;
      this._receive(event.data);
    };
    addEventListener("message", this._listener);
  }

  destroy() {
    removeEventListener("message", this._listener);
  }

  // --- transport --------------------------------------------------------

  _send(message, direction) {
    this._tee(direction, message);
    // The frame is sandboxed without allow-same-origin, so its origin is the
    // opaque string "null" and there is no origin to target. Identity comes
    // from comparing `event.source` against the frame, above.
    this.frame.contentWindow?.postMessage(message, "*");
  }

  _tee(direction, message) {
    const entry = { direction, message, at: performance.now() };
    this._log.push(entry);
    this.onMessage(entry);
  }

  request(method, params) {
    const id = ++this._id;
    return new Promise((resolve, reject) => {
      this._pending.set(id, { resolve, reject });
      this._send({ jsonrpc: "2.0", id, method, params }, "host→app");
    });
  }

  notify(method, params = {}) {
    this._send({ jsonrpc: "2.0", method, params }, "host→app");
  }

  async _receive(message) {
    if (!message || message.jsonrpc !== "2.0") return;
    this._tee("app→host", message);

    if (message.id !== undefined && message.method === undefined) {
      const pending = this._pending.get(message.id);
      if (!pending) return;
      this._pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
      return;
    }

    if (message.id !== undefined) {
      try {
        const result = await this._handle(message.method, message.params ?? {});
        this._send({ jsonrpc: "2.0", id: message.id, result }, "host→app");
      } catch (error) {
        this._send({
          jsonrpc: "2.0", id: message.id,
          error: { code: -32000, message: String(error?.message ?? error) },
        }, "host→app");
      }
      return;
    }

    this._handleNotification(message.method, message.params ?? {});
  }

  // --- requests from the view -------------------------------------------

  async _handle(method, params) {
    switch (method) {
      case "ui/initialize": {
        this.appInfo = params.appInfo;
        this.appCapabilities = params.appCapabilities ?? {};
        this.onEvent?.("initialize", params);
        return {
          protocolVersion: PROTOCOL_VERSION,
          hostInfo: this.hostInfo,
          hostCapabilities: this.hostCapabilities,
          hostContext: this.hostContext,
        };
      }

      case "tools/call": {
        if (!this.hostCapabilities.serverTools) {
          throw new Error("Host does not proxy server tools");
        }
        return await this._callServerTool(params.name, params.arguments ?? {});
      }

      case "tools/list":
        if (!this.hostCapabilities.serverTools) {
          throw new Error("Host does not proxy server tools");
        }
        return { tools: Object.values(this.config.serverTools ?? {})
          .map((t) => t.descriptor) };

      case "resources/read": {
        if (!this.hostCapabilities.serverResources) {
          throw new Error("Host does not proxy server resources");
        }
        const resource = (this.config.resources ?? {})[params.uri];
        if (!resource) throw new Error(`Resource not found: ${params.uri}`);
        return { contents: [{ uri: params.uri, ...resource }] };
      }

      case "ui/open-link": {
        if (!this.hostCapabilities.openLinks) {
          throw new Error("Link opening denied by user");
        }
        this.onEvent?.("open-link", params);
        return {};
      }

      case "ui/message": {
        if (!this.hostCapabilities.message) {
          throw new Error("Message sending denied");
        }
        this.onEvent?.("message", params);
        return {};
      }

      case "ui/update-model-context": {
        if (!this.hostCapabilities.updateModelContext) {
          throw new Error("Context update denied");
        }
        // Each update replaces the last one. A view that sends this on every
        // hover is not updating context, it is overwriting it.
        this._modelContext = params;
        this.onEvent?.("model-context", params);
        return {};
      }

      case "ui/request-display-mode": {
        const available = this.hostContext.availableDisplayModes ?? ["inline"];
        const declared = this.appCapabilities?.availableDisplayModes;
        const allowed = available.includes(params.mode)
          && (!declared || declared.includes(params.mode));
        const mode = allowed ? params.mode : this.hostContext.displayMode;
        if (mode !== this.hostContext.displayMode) {
          this.hostContext.displayMode = mode;
          this.onEvent?.("display-mode", { mode });
          this.notify("ui/notifications/host-context-changed", { displayMode: mode });
        }
        return { mode };
      }

      case "ui/download-file": {
        if (!this.hostCapabilities.downloadFile) {
          throw new Error("Download denied by user");
        }
        this.onEvent?.("download", params);
        return {};
      }

      case "sampling/createMessage": {
        if (!this.hostCapabilities.sampling) {
          throw new Error("Sampling not supported by host");
        }
        return await this._sample(params);
      }

      case "ping":
        return {};

      default:
        throw new Error(`Unsupported method: ${method}`);
    }
  }

  _handleNotification(method, params) {
    switch (method) {
      case "ui/notifications/initialized":
        this.initialized = true;
        this.onEvent?.("initialized", params);
        break;
      case "ui/notifications/size-changed":
        this.onEvent?.("size", params);
        break;
      case "ui/notifications/request-teardown":
        this.onEvent?.("request-teardown", params);
        break;
      case "notifications/message":
        this.onEvent?.("log", params);
        break;
      case "notifications/tools/list_changed":
        this.onEvent?.("app-tools-changed", params);
        break;
      default:
        break;
    }
  }

  // --- the server side, from fixtures -----------------------------------

  async _callServerTool(name, args) {
    const tool = (this.config.serverTools ?? {})[name];
    if (!tool) throw new Error(`Unknown tool: ${name}`);
    if (tool.delayMs) await sleep(tool.delayMs);
    const result = typeof tool.result === "function"
      ? await tool.result(args, this)
      : tool.result;
    return result;
  }

  async _sample(params) {
    const reply = this.config.sample
      ? await this.config.sample(params)
      : "The emulator has no model behind it, so this is a fixture.";
    return {
      role: "assistant",
      model: "fixture",
      content: { type: "text", text: reply },
    };
  }

  // --- things a host does that the view cannot ask for -------------------

  sendToolInput(args) {
    this.notify("ui/notifications/tool-input", { arguments: args });
  }

  sendPartialToolInput(args) {
    this.notify("ui/notifications/tool-input-partial", { arguments: args });
  }

  sendToolResult(result) {
    this.notify("ui/notifications/tool-result", result);
  }

  cancelTool(reason = "User stopped the request") {
    this.notify("ui/notifications/tool-cancelled", { reason });
  }

  patchContext(patch) {
    Object.assign(this.hostContext, patch);
    this.notify("ui/notifications/host-context-changed", patch);
  }

  teardown(reason = "Conversation closed") {
    return this.request("ui/resource-teardown", { reason });
  }

  callAppTool(name, args = {}) {
    return this.request("tools/call", { name, arguments: args });
  }

  listAppTools() {
    return this.request("tools/list", {});
  }

  get modelContext() {
    return this._modelContext;
  }

  get transcript() {
    return this._log;
  }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
