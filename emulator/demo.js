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

  render() {
    const spec = this.spec;

    this.frame = el("iframe", {
      src: `${this.base}${this.id}/index.html`,
      sandbox: "allow-scripts",
      title: spec.title ?? this.id,
      loading: "lazy",
    });

    this.stage = el("div", { class: "demo-stage" }, this.frame);
    this.controls = el("div", { class: "demo-controls" });
    this.transcript = el("div", { class: "demo-transcript" });
    this.notes = el("div", { class: "demo-notes" });

    this.panes = {
      transcript: el("div", { class: "demo-pane" }, this.transcript),
    };

    const tabs = el("div", { class: "demo-tabs" });
    const files = [
      ["transcript", "Messages"],
      ...(spec.files ?? []).map((f) => [f, f]),
    ];
    for (const [key, label] of files) {
      const tab = el("button", {
        class: "demo-tab", type: "button", text: label,
        onclick: () => this.show(key),
      });
      tabs.append(tab);
      if (!this.tabs) this.tabs = {};
      this.tabs[key] = tab;
      if (key !== "transcript") {
        this.panes[key] = el("div", { class: "demo-pane" },
          el("pre", {}, el("code", { text: "Loading…" })));
      }
    }

    this.mount.append(
      el("div", { class: "demo-head" },
        el("span", { class: "demo-title", text: spec.title ?? this.id }),
        el("span", { class: "demo-sub", text: spec.subtitle ?? "" })),
      this.stage,
      this.controls,
      this.notes,
      tabs,
      ...Object.values(this.panes),
    );

    this.show("transcript");
  }

  show(key) {
    for (const [k, pane] of Object.entries(this.panes)) {
      pane.hidden = k !== key;
      this.tabs[k].classList.toggle("current", k === key);
    }
    if (key !== "transcript" && !this.panes[key].dataset.loaded) {
      this.panes[key].dataset.loaded = "1";
      fetch(`${this.base}${this.id}/${key}`)
        .then((r) => (r.ok ? r.text() : Promise.reject(r.status)))
        .then((text) => {
          this.panes[key].querySelector("code").textContent = text;
        })
        .catch(() => {
          this.panes[key].querySelector("code").textContent =
            "Source unavailable.";
        });
    }
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
  }

  // Reload the view without rebuilding the host, so a control can change
  // what the host claims to support and let the view discover it again.
  reloadFrame() {
    this.frame.src = this.frame.src;
  }

  reload() {
    this.transcript.replaceChildren();
    this.notes.replaceChildren();
    this.rows = 0;
    this.host.destroy();
    this.frame.src = this.frame.src;
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
