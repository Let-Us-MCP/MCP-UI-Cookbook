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

  // --- resolving the view -------------------------------------------------

  // How a host actually decides what to render. The model calls a tool; the
  // host looks that tool up, reads `_meta.ui.resourceUri` off its metadata,
  // reads that resource, and renders the HTML that comes back. The view is
  // never named directly by anyone: the binding is the tool's metadata.
  //
  // Every step is teed into the transcript, because this sequence is the
  // thing the book spends Chapter 2 on and it belongs on screen rather than
  // in prose.
  async resolveView(toolName) {
    const tools = this.config.serverTools ?? {};
    const descriptor = tools[toolName]?.descriptor;
    this._tee("host→server", {
      jsonrpc: "2.0", id: "tools/list", method: "tools/list", params: {},
    });
    this._tee("server→host", {
      jsonrpc: "2.0", id: "tools/list",
      result: { tools: Object.values(tools).map((t) => t.descriptor) },
    });

    const uri = descriptor?._meta?.ui?.resourceUri;
    if (!uri) {
      throw new Error(`${toolName} has no _meta.ui.resourceUri, so a host has `
        + "nothing to render");
    }

    this._tee("host→server", {
      jsonrpc: "2.0", id: "resources/read", method: "resources/read",
      params: { uri },
    });
    const entry = (this.config.resources ?? {})[uri];
    if (!entry) throw new Error(`Resource not found: ${uri}`);
    const html = entry.text ?? await fetch(entry.href).then((r) => r.text());
    this._tee("server→host", {
      jsonrpc: "2.0", id: "resources/read",
      result: { contents: [{
        uri, mimeType: "text/html;profile=mcp-app",
        text: `${html.slice(0, 60)}… ${html.length} characters`,
        _meta: entry._meta ?? { ui: { csp: {}, prefersBorder: true } },
      }] },
    });
    // What the host granted, as opposed to what the server asked for. The
    // specification keeps these separate on purpose, and a view that assumes
    // its request was honoured breaks in the host that declined.
    const asked = entry._meta?.ui ?? {};
    this.hostCapabilities = {
      ...this.hostCapabilities,
      sandbox: {
        permissions: asked.permissions ?? {},
        csp: asked.csp ?? {},
      },
    };

    // `prefersBorder` is how a view asks to be visibly separate from the host,
    // which Chapter 4 treats as a defence against the phishing case rather
    // than as decoration.
    this.onEvent?.("prefers-border", { prefersBorder: asked.prefersBorder });

    return { uri, html, meta: entry._meta };
  }

  // What a host does with the contents it was handed. `EmbeddedResource`
  // carries the bytes inline as `text` or base64 `blob`; `ResourceLink` names
  // a URL the host fetches with its own network identity, which this emulator
  // does not do because it has no network.
  //
  // The suggested filename is the last segment of `resource.uri`, per the
  // specification, sanitised: a server that names a file `../../etc/passwd`
  // must not get one.
  _writeDownload(params) {
    for (const item of params?.contents ?? []) {
      if (item.type !== "resource") continue;
      const resource = item.resource ?? {};
      const name = (resource.uri ?? "download").split("/").pop()
        .replace(/[^A-Za-z0-9._-]/g, "_") || "download";
      const type = resource.mimeType || "application/octet-stream";
      const blob = typeof resource.text === "string"
        ? new Blob([resource.text], { type })
        : new Blob([Uint8Array.from(atob(resource.blob ?? ""),
                                    (c) => c.charCodeAt(0))], { type });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = name;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    }
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

      // Refusal is a result, not an error.
      //
      // `McpUiOpenLinkResult`, `McpUiMessageResult` and
      // `McpUiDownloadFileResult` each carry an optional `isError`, and the
      // specification uses it for exactly this: the host declined, or the user
      // cancelled. A JSON-RPC error means the request could not be processed
      // at all. Getting this backwards is why a view's `catch` never fires and
      // the user is told their file was saved when it was not.
      case "ui/open-link": {
        if (!this.hostCapabilities.openLinks) {
          this.onEvent?.("open-link-denied", params);
          return { isError: true };
        }
        this.onEvent?.("open-link", params);
        return {};
      }

      case "ui/message": {
        if (!this.hostCapabilities.message) {
          this.onEvent?.("message-denied", params);
          return { isError: true };
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
          this.onEvent?.("download-denied", params);
          return { isError: true };
        }
        this.onEvent?.("download", params);
        // A real host writes a file. This one only did so once the render
        // harness started asking, because until then every check verified the
        // request and nothing verified that anything came out of it.
        //
        // On unless a configuration turns it off. It was off at first, on the
        // reasoning that a book should not put files in a reader's downloads
        // folder. That reasoning was wrong: the button says Export CSV, the
        // reader pressed it, and a demonstration that narrates the save
        // instead of performing it is the thing Part VI argues against.
        if (this.config.performDownloads !== false) {
          try { this._writeDownload(params); }
          catch (error) { return { isError: true }; }
        }
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
