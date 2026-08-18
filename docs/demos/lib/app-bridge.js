// The view half of the MCP Apps bridge, in one file with no dependencies.
//
// Every demo in this book imports this. It is deliberately small enough to
// read in one sitting, because the point of the book is that the protocol is
// small enough to read in one sitting. Production apps should use
// @modelcontextprotocol/ext-apps, which does the same thing with schema
// validation, retries, and types; this exists so the transcript pane has
// nothing hidden behind it.
//
// Wire reference: MCP Apps extension (io.modelcontextprotocol/ui),
// JSON-RPC 2.0 over postMessage.
//
// Loaded as a classic script, not a module. The view runs in a sandboxed
// frame with an opaque origin, and module fetches from an opaque origin are
// CORS requests that a static file host will not answer. Classic scripts are
// not.

const PROTOCOL_VERSION = "2026-07-28";

class AppBridge {
  constructor(appInfo, appCapabilities = {}) {
    this.appInfo = appInfo;
    this.appCapabilities = appCapabilities;
    this.hostContext = {};
    this.hostCapabilities = {};
    this.hostInfo = null;
    this.tools = new Map();

    this._id = 0;
    this._pending = new Map();
    this._handlers = new Map();
    this._connected = false;

    addEventListener("message", (event) => this._receive(event));
  }

  // --- lifecycle --------------------------------------------------------

  async connect() {
    const result = await this.request("ui/initialize", {
      appInfo: this.appInfo,
      appCapabilities: this.appCapabilities,
      protocolVersion: PROTOCOL_VERSION,
    });
    this.hostInfo = result.hostInfo ?? null;
    this.hostCapabilities = result.hostCapabilities ?? {};
    this.hostContext = result.hostContext ?? {};
    this._connected = true;
    this.notify("ui/notifications/initialized", {});
    this._emit("connected", this.hostContext);
    return result;
  }

  // The host is allowed to change its mind about anything in the context at
  // any time. Merge, do not replace: the notification carries only the keys
  // that changed.
  _mergeContext(patch) {
    this.hostContext = { ...this.hostContext, ...patch };
    this._emit("hostcontextchanged", patch);
  }

  // --- transport --------------------------------------------------------

  request(method, params) {
    const id = ++this._id;
    const message = { jsonrpc: "2.0", id, method, params };
    return new Promise((resolve, reject) => {
      this._pending.set(id, { resolve, reject });
      parent.postMessage(message, "*");
    });
  }

  notify(method, params = {}) {
    parent.postMessage({ jsonrpc: "2.0", method, params }, "*");
  }

  on(event, handler) {
    if (!this._handlers.has(event)) this._handlers.set(event, []);
    this._handlers.get(event).push(handler);
    return this;
  }

  _emit(event, payload) {
    for (const handler of this._handlers.get(event) ?? []) handler(payload);
  }

  async _receive(event) {
    const message = event.data;
    if (!message || message.jsonrpc !== "2.0") return;

    // A response to something we sent.
    if (message.id !== undefined && message.method === undefined) {
      const pending = this._pending.get(message.id);
      if (!pending) return;
      this._pending.delete(message.id);
      if (message.error) pending.reject(new BridgeError(message.error));
      else pending.resolve(message.result);
      return;
    }

    // A request from the host. Only two exist, and both need an answer.
    if (message.id !== undefined) {
      try {
        const result = await this._handleRequest(message);
        parent.postMessage({ jsonrpc: "2.0", id: message.id, result }, "*");
      } catch (error) {
        parent.postMessage({
          jsonrpc: "2.0", id: message.id,
          error: { code: -32000, message: String(error?.message ?? error) },
        }, "*");
      }
      return;
    }

    // A notification from the host.
    switch (message.method) {
      case "ui/notifications/tool-input":
        this._emit("toolinput", message.params);
        break;
      case "ui/notifications/tool-input-partial":
        this._emit("toolinputpartial", message.params);
        break;
      case "ui/notifications/tool-result":
        this._emit("toolresult", message.params);
        break;
      case "ui/notifications/tool-cancelled":
        this._emit("toolcancelled", message.params);
        break;
      case "ui/notifications/host-context-changed":
        this._mergeContext(message.params ?? {});
        break;
      case "notifications/tools/list_changed":
        this._emit("servertoolschanged", message.params ?? {});
        break;
      default:
        break;
    }
  }

  async _handleRequest(message) {
    switch (message.method) {
      case "ui/resource-teardown": {
        // The host is about to remove the frame and is waiting for us. This
        // is the only chance to flush unsaved work.
        const waiters = this._handlers.get("teardown") ?? [];
        await Promise.all(waiters.map((h) => h(message.params ?? {})));
        return {};
      }
      case "tools/list":
        return { tools: [...this.tools.values()].map((t) => t.descriptor) };
      case "tools/call": {
        const tool = this.tools.get(message.params?.name);
        if (!tool) throw new Error(`Unknown tool: ${message.params?.name}`);
        return await tool.handler(message.params?.arguments ?? {});
      }
      case "ping":
        return {};
      default:
        throw new Error(`Unsupported method: ${message.method}`);
    }
  }

  // --- capabilities the host answers ------------------------------------

  callServerTool(name, args = {}) {
    return this.request("tools/call", { name, arguments: args });
  }

  listServerTools() {
    return this.request("tools/list", {});
  }

  readServerResource(uri) {
    return this.request("resources/read", { uri });
  }

  openLink(url) {
    return this.request("ui/open-link", { url });
  }

  sendMessage(text, role = "user") {
    return this.request("ui/message", { role, content: { type: "text", text } });
  }

  updateModelContext(params) {
    return this.request("ui/update-model-context", params);
  }

  requestDisplayMode(mode) {
    return this.request("ui/request-display-mode", { mode });
  }

  downloadFile(contents) {
    return this.request("ui/download-file", { contents });
  }

  createSamplingMessage(params) {
    return this.request("sampling/createMessage", params);
  }

  log(level, data) {
    this.notify("notifications/message", { level, data });
  }

  requestTeardown() {
    this.notify("ui/notifications/request-teardown", {});
  }

  // --- tools this view provides -----------------------------------------

  registerTool(descriptor, handler) {
    this.tools.set(descriptor.name, { descriptor, handler });
    if (this._connected && this.appCapabilities.tools?.listChanged) {
      this.notify("notifications/tools/list_changed", {});
    }
    return this;
  }

  // --- size -------------------------------------------------------------

  // The host sizes the frame from the outside and cannot see inside it, so
  // the view has to tell it. Sending on every observer callback would spam
  // the channel; sending only on change is what the SDK does.
  autoResize(element = document.documentElement) {
    let last = { width: 0, height: 0 };
    const report = () => {
      const width = Math.ceil(element.scrollWidth);
      const height = Math.ceil(element.scrollHeight);
      if (width === last.width && height === last.height) return;
      last = { width, height };
      this.notify("ui/notifications/size-changed", { width, height });
    };
    new ResizeObserver(report).observe(element);
    report();
    return this;
  }
}

class BridgeError extends Error {
  constructor(error) {
    super(error?.message ?? "Bridge error");
    this.name = "BridgeError";
    this.code = error?.code;
    this.data = error?.data;
  }
}

// Host style variables arrive as CSS custom properties. Applying them to the
// document root is the whole of the theming contract on the view side; the
// view still has to define its own fallbacks, because a host is allowed to
// send some variables and not others.
let appliedVariables = [];

function applyHostStyles(hostContext) {
  const root = document.documentElement;
  const variables = hostContext?.styles?.variables ?? {};
  // Variables the host has stopped sending have to be removed, not left
  // behind. The view is supposed to fall back to its own value, and it cannot
  // do that while last theme's override is still sitting on the root element.
  for (const name of appliedVariables) {
    if (variables[name] == null) root.style.removeProperty(name);
  }
  appliedVariables = [];
  for (const [name, value] of Object.entries(variables)) {
    if (value != null) {
      root.style.setProperty(name, value);
      appliedVariables.push(name);
    }
  }
  if (hostContext?.theme) root.dataset.theme = hostContext.theme;
  const fonts = hostContext?.styles?.css?.fonts;
  if (fonts) {
    const style = document.createElement("style");
    style.textContent = fonts;
    document.head.append(style);
  }
}

globalThis.McpApp = { AppBridge, BridgeError, applyHostStyles, PROTOCOL_VERSION };
