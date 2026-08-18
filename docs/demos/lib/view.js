// Small helpers every view in this book uses. Classic script, no build step.
//
// These are the parts of a UI toolkit that the protocol does not give you and
// that every app ends up writing: a toast, a confirmation, a live region, and
// formatting that respects the host's locale instead of the browser's.

(function (global) {
  "use strict";

  const h = (tag, attrs = {}, ...children) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else if (k === "html") node.innerHTML = v;
      else if (k.startsWith("on") && typeof v === "function") {
        node.addEventListener(k.slice(2), v);
      } else node.setAttribute(k, v === true ? "" : v);
    }
    node.append(...children.flat().filter((c) => c != null && c !== false));
    return node;
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  // A single polite live region. Screen readers announce changes to it; sighted
  // users never see it. Views that update a table without one leave assistive
  // technology guessing.
  function announce(text) {
    let region = $("#live-region");
    if (!region) {
      region = h("div", { id: "live-region", class: "sr-only",
                          role: "status", "aria-live": "polite" });
      document.body.append(region);
    }
    region.textContent = "";
    setTimeout(() => { region.textContent = text; }, 30);
  }

  function toast(text, ms = 2200) {
    let host = $(".toasts");
    if (!host) {
      host = h("div", { class: "toasts" });
      document.body.append(host);
    }
    const node = h("div", { class: "toast", role: "status", text });
    host.append(node);
    setTimeout(() => node.remove(), ms);
    return node;
  }

  // window.confirm is blocked in a sandbox without allow-modals, and blocking
  // the thread would freeze the bridge anyway. This is the in-view version:
  // same semantics, one promise, focus trapped by <dialog>.
  function confirmDialog({ title, body, confirm = "Confirm", cancel = "Cancel",
                           destructive = false }) {
    return new Promise((resolve) => {
      const dialog = h("dialog", {},
        h("h2", { text: title }),
        body ? h("p", { class: "muted", text: body }) : null,
        h("div", { class: "row", style: "justify-content:flex-end" },
          h("button", { class: "quiet", text: cancel,
            onclick: () => { dialog.close(); resolve(false); } }),
          h("button", { class: destructive ? "danger" : "primary", text: confirm,
            onclick: () => { dialog.close(); resolve(true); } })));
      dialog.addEventListener("cancel", () => resolve(false));
      dialog.addEventListener("close", () => dialog.remove());
      document.body.append(dialog);
      dialog.showModal();
    });
  }

  function promptDialog({ title, label, value = "", confirm = "Save" }) {
    return new Promise((resolve) => {
      const input = h("input", { value, "aria-label": label ?? title });
      const dialog = h("dialog", {},
        h("h2", { text: title }),
        h("label", { class: "stack" }, label ?? "", input),
        h("div", { class: "row", style: "justify-content:flex-end;margin-top:12px" },
          h("button", { class: "quiet", text: "Cancel",
            onclick: () => { dialog.close(); resolve(null); } }),
          h("button", { class: "primary", text: confirm,
            onclick: () => { dialog.close(); resolve(input.value); } })));
      dialog.addEventListener("cancel", () => resolve(null));
      dialog.addEventListener("close", () => dialog.remove());
      document.body.append(dialog);
      dialog.showModal();
      input.focus();
      input.select();
    });
  }

  // Safe-area insets arrive as numbers in the host context, not as the CSS
  // env() values a native app would read, because the view is inside someone
  // else's window.
  function applySafeArea(insets) {
    const root = document.documentElement;
    for (const side of ["top", "right", "bottom", "left"]) {
      root.style.setProperty(`--safe-${side}`, `${insets?.[side] ?? 0}px`);
    }
  }

  // Formatting belongs to the host's user, not to the machine the view happens
  // to be running on. `hostContext.locale` and `hostContext.timeZone` are the
  // only correct sources.
  function formatters(hostContext) {
    const locale = hostContext?.locale || undefined;
    const timeZone = hostContext?.timeZone || undefined;
    return {
      number: (n, options) => new Intl.NumberFormat(locale, options).format(n),
      currency: (n, currency = "USD") => new Intl.NumberFormat(locale, {
        style: "currency", currency }).format(n),
      date: (value, options = { dateStyle: "medium" }) =>
        new Intl.DateTimeFormat(locale, { ...options, timeZone })
          .format(value instanceof Date ? value : new Date(value)),
      time: (value) => new Intl.DateTimeFormat(locale, {
        timeStyle: "medium", timeZone })
        .format(value instanceof Date ? value : new Date(value)),
    };
  }

  // Everything a view needs at startup, in the order it needs it.
  async function boot(appInfo, appCapabilities, onReady) {
    const bridge = new global.McpApp.AppBridge(appInfo, appCapabilities);
    const result = await bridge.connect();
    global.McpApp.applyHostStyles(bridge.hostContext);
    applySafeArea(bridge.hostContext.safeAreaInsets);
    bridge.autoResize(document.body);
    bridge.on("hostcontextchanged", (patch) => {
      global.McpApp.applyHostStyles(bridge.hostContext);
      if (patch.safeAreaInsets) applySafeArea(patch.safeAreaInsets);
    });
    await onReady(bridge, result);
    return bridge;
  }

  global.View = { h, $, $$, announce, toast, confirmDialog, promptDialog,
                  applySafeArea, formatters, boot };
})(globalThis);
