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

  // CSV that survives its own data.
  //
  // `rows.map(r => r.join(","))` is what everybody writes and it is wrong the
  // first time a value contains a comma, a quote or a newline: the row gains a
  // column, or ends early, and the spreadsheet that opens it shows something
  // plausible and false. RFC 4180 wants a field quoted when it contains any of
  // those, with embedded quotes doubled.
  //
  // CRLF, also per RFC 4180. Excel needs it; everything else tolerates it.
  function toCsv(rows) {
    const field = (value) => {
      const text = value === null || value === undefined ? "" : String(value);
      return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    return rows.map((row) => row.map(field).join(",")).join("\r\n");
  }

  // A preview of a document, at one of three sizes.
  //
  // Everything here renders from bytes the view already holds. Nothing is
  // fetched, because a view cannot fetch anything its server did not declare,
  // and nothing is uploaded, because a preview that leaves the frame is not a
  // preview. `tools/check_sandbox.mjs` records that both routes below work
  // inside a sandboxed frame with an opaque origin: a data: URI renders, and
  // so does an object URL made from a File the user dropped.
  //
  // `size` is the caller's decision. A list wants "sm", a decision beside a
  // button wants "md", and reading wants "lg".
  const PREVIEWABLE_TEXT = /^text\/|json|xml|javascript|markdown/;

  function preview({ name, mimeType = "", text, blob, url, size = "md",
                     bytes }) {
    const node = h("div", { class: `preview ${size}` });
    const meta = [mimeType || "unknown type",
                  bytes ? `${Math.ceil(bytes / 1024)} kB` : null]
      .filter(Boolean).join(" · ");
    node.append(h("div", { class: "preview-head" },
      h("span", { class: "preview-name", text: name ?? "Untitled" }),
      h("span", { class: "preview-meta", text: meta })));

    const body = h("div", { class: "preview-body" });
    if (mimeType.startsWith("image/")) {
      // Three ways to name the same pixels. A data: URI for bytes that
      // arrived in a tool result, an object URL for a File the user chose,
      // and a plain URL only where the server declared the origin in its CSP.
      const src = url ?? (blob ? `data:${mimeType};base64,${blob}` : null);
      if (src) {
        body.append(h("img", { class: "preview-image", src,
          // The name is the caption; alt text saying "thumbnail" tells a
          // screen reader user nothing they did not already know.
          alt: `Preview of ${name ?? "the image"}` }));
      } else {
        body.append(h("p", { class: "preview-none",
          text: "No image data arrived with this file." }));
      }
    } else if (typeof text === "string" && PREVIEWABLE_TEXT.test(mimeType)) {
      // Truncated by size, because reading 400 kB into a 48 pixel box costs
      // the same as reading it into a large one and shows a fiftieth of it.
      const limit = size === "sm" ? 220 : size === "md" ? 1200 : 8000;
      const shown = text.length > limit ? `${text.slice(0, limit)}\n…` : text;
      body.append(h("pre", { class: "preview-text", text: shown }));
    } else {
      // Saying what it is beats rendering bytes as mojibake.
      body.append(h("p", { class: "preview-none", text:
        `No preview for ${mimeType || "this type"}. `
        + "Open it, or download it, to see what is in it." }));
    }
    node.append(body);
    return node;
  }

  // The size control, as a group of toggles rather than a select: three
  // options is below the threshold where a menu helps, and the current size
  // should be visible without opening anything.
  function previewSizes(current, onPick) {
    const labels = { sm: "Small", md: "Medium", lg: "Large" };
    const group = h("div", { class: "preview-sizes", role: "group",
                             "aria-label": "Preview size" });
    for (const key of ["sm", "md", "lg"]) {
      group.append(h("button", {
        type: "button", class: "quiet", text: labels[key],
        "aria-pressed": key === current ? "true" : "false",
        "data-size": key,
        onclick: () => onPick(key),
      }));
    }
    return group;
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
                  applySafeArea, formatters, preview, previewSizes, toCsv, boot };
})(globalThis);
