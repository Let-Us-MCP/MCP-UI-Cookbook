// The three-pane demo widget: running app, its source, and the messages
// between them.
//
// A page declares a demo with `<div class="demo" data-demo="lab-surface">`.
// This module finds those, loads `demos/<id>/demo.js` for the host fixture,
// mounts the view in a sandboxed iframe, and wires the transcript.
//
// Nothing here is a mock of the app. The iframe runs the same file the code
// pane displays, and the transcript is the real message log, not a replay.

import { HostEmulator } from "./host.js";

const METHOD_CLASS = (method) =>
  method?.startsWith("ui/") ? "ui"
  : method?.startsWith("tools/") ? "tools"
  : method?.startsWith("resources/") ? "tools"
  : method?.startsWith("notifications/") ? "log"
  : method ? "other" : "result";

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  node.append(...children.filter(Boolean));
  return node;
}

class Demo {
  constructor(mount, id, base) {
    this.mount = mount;
    this.id = id;
    this.base = base;
    this.rows = 0;
  }

  async start() {
    // Dynamic import resolves against this module's URL, not the page's, so
    // the specifier has to be made absolute against the document first.
    const url = new URL(`${this.base}${this.id}/demo.js`, document.baseURI);
    const module = await import(url.href);
    this.spec = module.demo;
    this.render();
    await this.boot();
  }

  // A host does not know the URL of a view. It knows a tool, reads
  // `_meta.ui.resourceUri` off that tool, reads the resource, and renders what
  // comes back. Recipes go through that sequence for real; the capability labs
  // have no server, so they load their file directly.
  async resolveAndRender() {
    const { html } = await this.host.resolveView(this.spec.tool);
    const dir = new URL(`${this.base}${this.id}/`, document.baseURI).href;
    // The returned document is rendered as-is except for a base URL. A real
    // host hands the HTML to a sandbox proxy on its own origin, where relative
    // paths resolve; srcdoc has no origin of its own, so the base is how the
    // view's own stylesheet and bridge still load.
    this.frame.srcdoc = html.replace(/<head>/i, `<head><base href="${dir}">`);
  }

  render() {
    const spec = this.spec;

    this.frame = el("iframe", {
      ...(spec.tool ? {} : { src: `${this.base}${this.id}/index.html` }),
      sandbox: "allow-scripts",
      title: spec.title ?? this.id,
      loading: "lazy",
    });

    this.stage = el("div", { class: "demo-stage" }, this.frame);
    this.controls = el("div", { class: "demo-controls" });
    this.transcript = el("div", { class: "demo-transcript" });
    this.notes = el("div", { class: "demo-notes" });

    // The source slides out from under the running application rather than
    // sitting beside it. A copy button, because the reason people open a
    // cookbook is to take the code away.
    this.tabs = {};
    this.panes = {};
    this.sources = {};
    const files = spec.files ?? [];
    const tabStrip = el("div", { class: "demo-tabs" });
    for (const file of files) {
      this.tabs[file] = el("button", {
        class: "demo-tab", type: "button", text: file,
        onclick: () => this.show(file),
      });
      tabStrip.append(this.tabs[file]);
      this.panes[file] = el("div", { class: "demo-pane" },
        el("pre", {}, el("code", { text: "Loading…" })));
    }

    this.copyButton = el("button", {
      class: "demo-copy", type: "button", text: "Copy",
      onclick: () => this.copy(),
    });

    this.toggle = el("button", {
      class: "demo-toggle", type: "button",
      "aria-expanded": "false", "aria-controls": `${this.id}-source`,
      onclick: () => this.slide(),
    }, el("span", { class: "chev" }), el("span", { text: "Source" }));

    this.drawer = el("div", {
      class: "demo-drawer shut", id: `${this.id}-source`,
    }, el("div", { class: "demo-drawer-inner" },
        tabStrip, ...Object.values(this.panes)));

    const codeSection = files.length
      ? el("div", { class: "demo-code" },
          el("div", { class: "demo-bar" }, this.toggle,
            el("span", { class: "spacer" }), this.copyButton),
          this.drawer)
      : null;

    this.mount.append(
      el("div", { class: "demo-head" },
        el("span", { class: "demo-title", text: spec.title ?? this.id }),
        el("span", { class: "demo-sub", text: spec.subtitle ?? "" })),
      this.stage,
      this.controls,
      this.notes,
      codeSection,
      el("div", { class: "demo-log" },
        el("div", { class: "demo-label", text: "Messages" }),
        this.transcript),
    );

    if (files.length) this.show(files[0]);
  }

  slide() {
    const open = this.toggle.getAttribute("aria-expanded") === "true";
    this.toggle.setAttribute("aria-expanded", open ? "false" : "true");
    this.drawer.classList.toggle("shut", open);
  }

  // The clipboard chapter in two paths, used by the page that teaches it.
  async copy() {
    const text = this.sources[this.current] ?? "";
    if (!text) return;
    let ok = true;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.append(area);
      area.select();
      ok = document.execCommand("copy");
      area.remove();
    }
    this.copyButton.textContent = ok ? "Copied" : "Copy failed";
    setTimeout(() => { this.copyButton.textContent = "Copy"; }, 1600);
  }

  show(key) {
    for (const [name, pane] of Object.entries(this.panes)) {
      pane.hidden = name !== key;
      this.tabs[name].classList.toggle("current", name === key);
    }
    this.current = key;
    const pane = this.panes[key];
    if (pane.dataset.loaded) return;
    pane.dataset.loaded = "1";
    fetch(`${this.base}${this.id}/${key}`)
      .then((r) => (r.ok ? r.text() : Promise.reject(r.status)))
      .then((text) => {
        this.sources[key] = text;
        pane.querySelector("code").textContent = text;
      })
      .catch(() => {
        pane.querySelector("code").textContent = "Source unavailable.";
      });
  }

  async boot() {
    const spec = this.spec;
    this.host = new HostEmulator(this.frame, spec.host ?? {},
      (entry) => this.log(entry));

    this.host.onEvent = (event, params) => {
      if (event === "size") {
        const height = Math.min(params.height ?? 0, spec.maxHeight ?? 520);
        if (height > 0) this.frame.style.height = `${height}px`;
      }
      if (event === "prefers-border") {
        this.stage.classList.toggle("bordered", params.prefersBorder === true);
      }
      if (event === "initialized" && spec.onReady) spec.onReady(this.host);
      this.note(event, params);
    };

    for (const control of spec.controls ?? []) {
      this.controls.append(el("button", {
        type: "button", class: "demo-button", text: control.label,
        onclick: () => control.run(this.host, this),
      }));
    }
    this.controls.append(el("button", {
      type: "button", class: "demo-button ghost", text: "Reload view",
      onclick: () => this.reload(),
    }));

    if (spec.tool) await this.resolveAndRender();
  }

  // Reload the view without rebuilding the host, so a control can change
  // what the host claims to support and let the view discover it again.
  reloadFrame() {
    if (this.spec.tool) this.resolveAndRender();
    else this.frame.src = this.frame.src;
  }

  reload() {
    this.transcript.replaceChildren();
    this.notes.replaceChildren();
    this.rows = 0;
    this.host.destroy();
    if (!this.spec.tool) this.frame.src = this.frame.src;
    this.boot();
  }

  note(event, params) {
    const interesting = {
      "open-link": (p) => `Host would open ${p.url}`,
      message: (p) => `Host received a chat message: ${p.content?.text ?? ""}`,
      "model-context": () => "Host replaced the view's model context",
      download: (p) => `Host would save ${
        p.contents?.[0]?.resource?.uri ?? p.contents?.[0]?.uri ?? "a file"}`,
      "display-mode": (p) => `Display mode is now ${p.mode}`,
      "request-teardown": () => "View asked to be torn down",
      log: (p) => `Log (${p.level}): ${
        typeof p.data === "string" ? p.data : JSON.stringify(p.data)}`,
    };
    const render = interesting[event];
    if (!render) return;
    const line = el("p", { class: "demo-note", text: render(params) });
    this.notes.prepend(line);
    while (this.notes.children.length > 4) this.notes.lastChild.remove();
  }

  log(entry) {
    const { direction, message } = entry;
    const method = message.method
      ?? (message.error ? "error" : "result");
    const summary = el("summary", {},
      el("span", { class: "arrow", text: direction === "app→host" ? "▲" : "▼" }),
      el("span", { class: `method ${METHOD_CLASS(message.method)}`, text: method }),
      el("span", { class: "dir", text: direction }));
    const body = JSON.stringify(message, null, 2);
    const row = el("details", { class: "demo-row" }, summary,
      el("pre", {}, el("code", { text: body })));
    this.transcript.append(row);
    this.transcript.scrollTop = this.transcript.scrollHeight;
    this.rows += 1;
    while (this.transcript.children.length > 200) {
      this.transcript.firstChild.remove();
    }
  }
}

export function mountDemos(base = "demos/") {
  for (const mount of document.querySelectorAll(".demo[data-demo]")) {
    if (mount.dataset.mounted) continue;
    mount.dataset.mounted = "1";
    new Demo(mount, mount.dataset.demo, base).start().catch((error) => {
      mount.append(el("p", { class: "demo-error",
        text: `This demo failed to load: ${error}` }));
    });
  }
}

if (document.readyState === "loading") {
  addEventListener("DOMContentLoaded", () => mountDemos());
} else {
  mountDemos();
}
