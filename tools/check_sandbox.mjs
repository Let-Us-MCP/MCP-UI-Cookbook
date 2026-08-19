#!/usr/bin/env node
/* Test what a sandboxed view can actually do, instead of reasoning about it.
 *
 * Appendix B says a set of things are impossible inside a view: the clipboard
 * cannot be read, printing is blocked, sharing is unavailable, storage throws.
 * Every one of those is a claim about a browser, and this book's standard for
 * a claim about a browser is a run rather than an argument.
 *
 * This loads a probe document into a real `sandbox="allow-scripts"` iframe
 * with an opaque origin, runs each experiment, and writes the results to
 * `conformance/sandbox.json`. Appendix B quotes that file.
 *
 * Where an experiment finds a route the book called absent, that is a finding
 * against the book and the entry has to change.
 *
 *   node tools/check_sandbox.mjs
 *   node tools/check_sandbox.mjs --check    # fail if the record is stale
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = Number(process.env.SANDBOX_PORT || 8987);
const CDP_PORT = Number(process.env.SANDBOX_CDP || 9237);

const CHROME_CANDIDATES = [
  process.env.CHROME,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
];

function findChrome() {
  for (const c of CHROME_CANDIDATES) if (c && fs.existsSync(c)) return c;
  throw new Error("no Chrome found; set CHROME=/path/to/chrome");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Sharing has two outcomes that both mean "the browser was willing", and which
// one you get depends on how fast a headless share surface gives up. Recording
// the raw string would make this file change between identical runs, so the
// experiment records the verdict and keeps the observation beside it.
function classifyShare(raw) {
  const denied = /NotAllowedError|Permission denied/.test(raw.error ?? "");
  return {
    verdict: denied ? "denied before any surface appeared"
                    : "reached the browser's own share surface",
    ok: raw.ok ?? false,
  };
}

// The probe runs inside the frame. Everything it reports is what the browser
// did, not what anybody expected it to do.
const PROBE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>probe</title></head>
<body>
<input id="target" aria-label="paste target">
<div id="dragme" draggable="true">drag me</div>
<script>
window.__paste = null;
document.getElementById("target").addEventListener("paste", (e) => {
  window.__paste = {
    fired: true,
    types: [...(e.clipboardData?.types ?? [])],
    text: e.clipboardData?.getData("text/plain") ?? null,
  };
});
document.getElementById("dragme").addEventListener("dragstart", (e) => {
  try {
    e.dataTransfer.setData("text/plain", "from inside the view");
    window.__dragstart = { allowed: true,
      types: [...e.dataTransfer.types] };
  } catch (error) {
    window.__dragstart = { allowed: false, error: String(error.name) };
  }
});

window.__probe = () => {
  const out = {};
  const attempt = (name, fn) => {
    try { out[name] = { ok: true, value: fn() }; }
    catch (error) { out[name] = { ok: false, error: error.name + ": " + error.message.slice(0, 80) }; }
  };

  out.origin = { ok: true, value: String(window.origin) };
  out.isOpaqueOrigin = { ok: true, value: window.origin === "null" };

  attempt("localStorage", () => { window.localStorage.setItem("k", "v"); return "wrote"; });
  attempt("sessionStorage", () => { window.sessionStorage.setItem("k", "v"); return "wrote"; });
  attempt("indexedDBObject", () => (window.indexedDB ? "present" : "absent"));
  attempt("cookieWrite", () => { document.cookie = "k=v"; return document.cookie || "(empty)"; });

  out.clipboardApiPresent = { ok: true, value: !!navigator.clipboard };
  out.clipboardReadTextPresent = { ok: true, value: typeof navigator.clipboard?.readText === "function" };
  out.sharePresent = { ok: true, value: typeof navigator.share === "function" };
  out.printPresent = { ok: true, value: typeof window.print === "function" };
  out.dragAndDropPresent = { ok: true, value: "ondragstart" in document.createElement("div") };
  out.fileInputPresent = { ok: true, value: (() => {
    const i = document.createElement("input"); i.type = "file"; return i.type === "file";
  })() };
  out.execCommandPresent = { ok: true, value: typeof document.execCommand === "function" };

  attempt("windowOpen", () => {
    const w = window.open("about:blank");
    if (w) { w.close(); return "opened"; }
    return "returned null";
  });

  return JSON.stringify(out);
};

// Presence of a function is not availability of a capability. Each of these
// calls the thing and reports what came back.
window.__callShare = async () => {
  // A share surface that waits for a person never resolves without one, so
  // the experiment races it and reports the wait as the result.
  const timeout = new Promise((r) => setTimeout(
    () => r(JSON.stringify({ ok: false, error: "no answer in 3s; the browser "
      + "presented a share surface and waited" })), 3000));
  const attempt = (async () => {
    try {
      await navigator.share({ title: "probe", text: "probe" });
      return JSON.stringify({ ok: true, value: "resolved" });
    } catch (error) {
      return JSON.stringify({ ok: false, error: error.name + ": " + error.message.slice(0, 90) });
    }
  })();
  return Promise.race([attempt, timeout]);
};

window.__openIndexedDB = () => new Promise((resolve) => {
  let request;
  try {
    request = window.indexedDB.open("probe", 1);
  } catch (error) {
    resolve(JSON.stringify({ ok: false, error: error.name + ": " + error.message.slice(0, 90) }));
    return;
  }
  request.onsuccess = () => resolve(JSON.stringify({ ok: true, value: "opened" }));
  request.onerror = () => resolve(JSON.stringify({ ok: false,
    error: String(request.error?.name ?? "error") }));
  setTimeout(() => resolve(JSON.stringify({ ok: false, error: "no answer in 2s" })), 2000);
});

// Can a view show a preview of a document at all? Everything a preview needs
// is a URL the frame is allowed to load, and an opaque origin plus a
// restrictive content security policy is exactly where those stop working.
// A 1x1 PNG is enough: what is being tested is whether the URL loads, not
// whether the decoder works.
const PNG_1X1 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8"
  + "z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    const done = (ok, why) => resolve({ ok, value: ok ? "rendered" : undefined,
                                        error: ok ? undefined : why });
    img.onload = () => done(img.naturalWidth > 0, "loaded with no pixels");
    img.onerror = () => done(false, "the load was blocked or failed");
    setTimeout(() => done(false, "no answer in 2s"), 2000);
    img.src = src;
  });
}

window.__previewDataUri = () => loadImage("data:image/png;base64," + PNG_1X1)
  .then((r) => JSON.stringify(r));

window.__previewObjectUrl = async () => {
  try {
    const bytes = Uint8Array.from(atob(PNG_1X1), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: "image/png" }));
    const result = await loadImage(url);
    // The scheme and origin are the finding; the rest of an object URL is a
    // fresh UUID every run, and recording it would make this file differ from
    // itself.
    result.scheme = url.slice(0, url.indexOf("/", 5));
    URL.revokeObjectURL(url);
    return JSON.stringify(result);
  } catch (error) {
    return JSON.stringify({ ok: false, error: error.name + ": " + error.message.slice(0, 80) });
  }
};

// The other half of a preview: reading an uploaded file's bytes without
// sending them anywhere.
window.__readFileLocally = async () => {
  try {
    const file = new File(["the quick brown fox"], "note.txt", { type: "text/plain" });
    const text = await file.text();
    return JSON.stringify({ ok: true, value: "read " + text.length + " characters" });
  } catch (error) {
    return JSON.stringify({ ok: false, error: error.name + ": " + error.message.slice(0, 80) });
  }
};

// An HTML document previewed inside the view needs a nested frame, and a
// sandboxed frame may only create a frame at least as restricted as itself.
window.__nestedFrame = () => new Promise((resolve) => {
  try {
    const inner = document.createElement("iframe");
    inner.setAttribute("sandbox", "");
    inner.srcdoc = "<p id=probe>nested</p>";
    inner.onload = () => {
      const reachable = (() => {
        try { return !!inner.contentDocument?.getElementById("probe"); }
        catch { return false; }
      })();
      inner.remove();
      resolve(JSON.stringify({ ok: true,
        value: reachable ? "rendered and readable" : "rendered, not readable" }));
    };
    inner.onerror = () => { inner.remove(); resolve(JSON.stringify({ ok: false, error: "failed" })); };
    document.body.append(inner);
    setTimeout(() => resolve(JSON.stringify({ ok: false, error: "no answer in 2s" })), 2000);
  } catch (error) {
    resolve(JSON.stringify({ ok: false, error: error.name + ": " + error.message.slice(0, 80) }));
  }
});

window.__readClipboard = async () => {
  try {
    const text = await navigator.clipboard.readText();
    return JSON.stringify({ ok: true, value: text });
  } catch (error) {
    return JSON.stringify({ ok: false, error: error.name + ": " + error.message.slice(0, 90) });
  }
};

window.__doPrint = () => {
  try { window.print(); return JSON.stringify({ ok: true, value: "returned" }); }
  catch (error) { return JSON.stringify({ ok: false, error: String(error.name) }); }
};
<\/script></body></html>
`;

// Two frames running the identical probe: one sandboxed the way a host
// sandboxes a view, one not sandboxed at all. Without the control, every
// refusal in the sandboxed frame could be an artefact of running headless,
// and attributing it to the sandbox would be a guess wearing a result.
const SHELL = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>sandbox probe host</title></head>
<body>
<iframe id="view" src="probe.html" sandbox="allow-scripts"
        style="width:600px;height:200px;border:0"></iframe>
<iframe id="control" src="probe.html"
        style="width:600px;height:200px;border:0"></iframe>
<div id="hostdrop" style="width:600px;height:80px;background:#eee">host drop zone</div>
<script>
window.__hostDrop = null;
const zone = document.getElementById("hostdrop");
zone.addEventListener("dragover", (e) => { e.preventDefault(); });
zone.addEventListener("drop", (e) => {
  e.preventDefault();
  window.__hostDrop = {
    fired: true,
    types: [...(e.dataTransfer?.types ?? [])],
    text: e.dataTransfer?.getData("text/plain") ?? null,
  };
});
window.__hostReady = true;
<\/script>
</body></html>
`;

class Browser {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.sessions = new Set();
    this.frameSession = null;
    // With Input.setInterceptDrags on, Chrome hands the drag data to the
    // debugger instead of running the drag itself. Catching this is the only
    // way to learn that a drag started at all in headless.
    this.dragIntercepted = null;
    ws.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
        return;
      }
      if (msg.method === "Input.dragIntercepted") {
        this.dragIntercepted = msg.params?.data ?? null;
      }
      if (msg.method === "Target.attachedToTarget") {
        const { sessionId, targetInfo } = msg.params;
        this.sessions.add(sessionId);
        // Only the sandboxed frame gets its own target: an opaque origin is a
        // different origin, and the same-origin control frame stays in the
        // page's own execution context.
        if (targetInfo.type === "iframe") this.frameSession = sessionId;
      }
    });
  }

  send(method, params = {}, sessionId) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params, sessionId }));
      setTimeout(() => reject(new Error(
        `${method} timed out: ${JSON.stringify(params).slice(0, 120)}`)), 15000);
    });
  }

  async evalIn(sessionId, expression) {
    const r = await this.send("Runtime.evaluate",
      { expression, returnByValue: true, awaitPromise: true, userGesture: true },
      sessionId);
    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.exception?.description ?? "eval failed");
    }
    return r.result?.value;
  }
}

async function main() {
  const checkOnly = process.argv.includes("--check");
  const workdir = fs.mkdtempSync(path.join(os.tmpdir(), "sandbox-"));
  fs.writeFileSync(path.join(workdir, "shell.html"), SHELL);
  fs.writeFileSync(path.join(workdir, "probe.html"), PROBE);

  const server = http.createServer((req, res) => {
    const file = path.join(workdir, decodeURIComponent(req.url.split("?")[0]));
    if (!file.startsWith(workdir) || !fs.existsSync(file)) {
      res.writeHead(404).end("not found");
      return;
    }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8",
                         "cache-control": "no-store" });
    fs.createReadStream(file).pipe(res);
  }).listen(PORT);

  const chrome = spawn(findChrome(), [
    "--headless=new", `--remote-debugging-port=${CDP_PORT}`,
    "--no-first-run", "--no-default-browser-check",
    `--user-data-dir=${path.join(workdir, "profile")}`,
    "about:blank",
  ], { stdio: "ignore" });

  const cleanup = () => { try { chrome.kill(); } catch {} server.close(); };

  try {
    let target;
    for (let i = 0; i < 40; i += 1) {
      try {
        target = await (await fetch(
          `http://127.0.0.1:${CDP_PORT}/json/new?http://127.0.0.1:${PORT}/shell.html`,
          { method: "PUT" })).json();
        break;
      } catch { await sleep(250); }
    }
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener("open", r, { once: true }));
    const browser = new Browser(ws);

    await browser.send("Target.setAutoAttach",
      { autoAttach: true, waitForDebuggerOnStart: false, flatten: true });
    await browser.send("Page.enable");
    await browser.send("Runtime.enable");
    await sleep(1500);

    const frame = browser.frameSession;
    if (!frame) throw new Error("no sandboxed frame attached");

    // Headless windows are not focused, and the clipboard refuses to be read
    // by an unfocused document, which would make the clipboard experiments
    // report the wrong reason for the right answer.
    await browser.send("Page.bringToFront").catch(() => {});
    await browser.send("Emulation.setFocusEmulationEnabled", { enabled: true })
      .catch(() => {});

    const results = JSON.parse(await browser.evalIn(frame, "window.__probe()"));
    results.indexedDBOpen = JSON.parse(await browser.evalIn(frame, "window.__openIndexedDB()"));
    results.shareCall = classifyShare(
      JSON.parse(await browser.evalIn(frame, "window.__callShare()")));

    // The clipboard, twice: once with the permission granted at browser level
    // to show that the grant does not reach an opaque origin, and once through
    // a real paste, which is the route the book proposes as the workaround.
    await browser.send("Browser.grantPermissions",
      { permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"] });
    results.clipboardReadWithPermission =
      JSON.parse(await browser.evalIn(frame, "window.__readClipboard()"));

    // Put something on the system clipboard from the top page, then paste it
    // into the frame with a real key event.
    await browser.evalIn(undefined,
      `navigator.clipboard.writeText("pasted through a user gesture")`);
    await browser.evalIn(frame, `document.getElementById("target").focus(); true`);
    const modifier = process.platform === "darwin" ? 4 : 2; // meta : ctrl
    // `commands` is how Chrome delivers an editing command for a key chord.
    // Dispatching the chord alone reaches the handler without performing the
    // paste, which would test the wrong thing.
    await browser.send("Input.dispatchKeyEvent", {
      type: "keyDown", key: "v", code: "KeyV", windowsVirtualKeyCode: 86,
      modifiers: modifier, commands: ["paste"],
    });
    await browser.send("Input.dispatchKeyEvent", {
      type: "keyUp", key: "v", code: "KeyV", windowsVirtualKeyCode: 86,
      modifiers: modifier,
    });
    await sleep(600);
    results.pasteEvent = {
      ok: true,
      value: await browser.evalIn(frame, "JSON.stringify(window.__paste)"),
    };

    results.printCall = JSON.parse(await browser.evalIn(frame, "window.__doPrint()"));

    for (const [name, call] of [
      ["previewDataUri", "window.__previewDataUri()"],
      ["previewObjectUrl", "window.__previewObjectUrl()"],
      ["readFileLocally", "window.__readFileLocally()"],
      ["nestedSandboxedFrame", "window.__nestedFrame()"],
    ]) {
      results[name] = JSON.parse(await browser.evalIn(frame, call));
    }

    // Can anything be dragged out of a view and into the host's own document?
    // Appendix B says no. That is a claim about the browser, so it gets a run.
    // The drag is intercepted rather than simulated with raw mouse events,
    // because Chrome only builds a real dataTransfer for an intercepted drag.
    let dragOut = { attempted: true };
    try {
      await browser.send("Input.setInterceptDrags", { enabled: true });
      // The frame is its own target, so the page session's interception does
      // not cover a drag that begins inside it.
      if (frame) {
        await browser.send("Input.setInterceptDrags", { enabled: true }, frame)
          .catch(() => {});
      }
      const box = await browser.evalIn(undefined, `(() => {
        const f = document.getElementById("view").getBoundingClientRect();
        const z = document.getElementById("hostdrop").getBoundingClientRect();
        return JSON.stringify({ fx: f.x, fy: f.y,
                                zx: z.x + z.width / 2, zy: z.y + z.height / 2 });
      })()`);
      const at = JSON.parse(box);
      // The press has to land on the draggable element, so its position is
      // read inside the frame and offset by where the frame sits on the page.
      const inner = JSON.parse(await browser.evalIn(frame, `(() => {
        const r = document.getElementById("dragme").getBoundingClientRect();
        return JSON.stringify({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
      })()`));
      at.fx += inner.x;
      at.fy += inner.y;
      await browser.send("Input.dispatchMouseEvent",
        { type: "mousePressed", x: at.fx, y: at.fy, button: "left", clickCount: 1 });
      // One move is below the threshold that starts a drag. Several, growing,
      // is what a hand does.
      for (const d of [6, 14, 26, 44, 70]) {
        await browser.send("Input.dispatchMouseEvent",
          { type: "mouseMoved", x: at.fx + d, y: at.fy + d, button: "left",
            buttons: 1 });
        await sleep(60);
      }
      await sleep(300);
      dragOut.dragStartInView = JSON.parse(
        await browser.evalIn(frame, "JSON.stringify(window.__dragstart ?? null)") || "null");
      dragOut.dragData = browser.dragIntercepted;
      if (browser.dragIntercepted) {
        // The mouse press only asks for a drag. Once Chrome has handed over
        // the data the debugger has to carry it, which is what puts the drop
        // on the host's own document rather than back inside the frame.
        const data = browser.dragIntercepted;
        for (const type of ["dragEnter", "dragOver", "drop"]) {
          await browser.send("Input.dispatchDragEvent",
            { type, x: at.zx, y: at.zy, data });
          await sleep(80);
        }
      } else {
        await browser.send("Input.dispatchMouseEvent",
          { type: "mouseReleased", x: at.zx, y: at.zy, button: "left", clickCount: 1 });
      }
      await sleep(300);
      dragOut.hostReceived = JSON.parse(
        await browser.evalIn(undefined, "JSON.stringify(window.__hostDrop ?? null)") || "null");
    } catch (error) {
      dragOut.error = String(error.message).slice(0, 120);
    }
    // The press has to land on the draggable element itself. An earlier run
    // pressed at a fixed offset inside the frame, missed it, and read the
    // silence as headless refusing to drag at all.
    //
    // Chrome builds the payload and hands it to the debugger, which then
    // carries it to the drop point, because a headless run has no drag loop
    // of its own. So `dragIntercepted` is the evidence that an opaque origin
    // can export transfer data, and the delivery half is driven rather than
    // observed. That distinction is stated in the verdict.
    dragOut.verdict = !dragOut.dragStartInView
      ? "inconclusive: no drag started, so this run tested nothing"
      : !dragOut.dragData
        ? "a drag started in the view but Chrome exported no transfer data"
        : dragOut.hostReceived
          ? "the view exported transfer data and a drop carrying it reached "
            + "the host document; the harness carried the drop"
          : "the view exported transfer data and the host document received "
            + "nothing";
    results.dragOutOfView = dragOut;

    // The control frame is same-origin with the page, so it is reachable
    // without a separate session.
    const control = {};
    const inControl = (expr) => browser.evalIn(undefined,
      `document.getElementById("control").contentWindow.${expr}`);
    control.origin = { ok: true, value: await inControl("origin") };
    control.probe = JSON.parse(await inControl("__probe()"));
    control.indexedDBOpen = JSON.parse(await inControl("__openIndexedDB()"));
    control.shareCall = classifyShare(JSON.parse(await inControl("__callShare()")));
    control.clipboardRead = JSON.parse(await inControl("__readClipboard()"));

    const record = {
      note: "Recorded by tools/check_sandbox.mjs in a real "
          + "sandbox=\"allow-scripts\" iframe with an opaque origin. "
          + "Regenerate with `make sandbox`.",
      userAgentBrand: await browser.evalIn(undefined,
        "(navigator.userAgentData?.brands ?? []).map(b => b.brand + ' ' + b.version).join(', ') || navigator.userAgent"),
      results,
      control,
    };

    const file = path.join(ROOT, "conformance", "sandbox.json");
    const text = `${JSON.stringify(record, null, 2)}\n`;
    const before = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;

    for (const [name, r] of Object.entries({ ...results,
        "control:clipboardRead": control.clipboardRead,
        "control:shareCall": control.shareCall,
        "control:indexedDBOpen": control.indexedDBOpen })) {
      const shown = r === undefined ? "(not run)"
        : r.verdict ? r.verdict
        : r.ok ? JSON.stringify(r.value).slice(0, 70)
        : `refused (${r.error})`;
      console.log(`  ${name.padEnd(28)} ${shown}`);
    }

    if (before !== text) {
      if (checkOnly) {
        console.error("  sandbox record is stale; run `make sandbox`");
        cleanup();
        process.exit(1);
      }
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, text);
      console.log("sandbox record written");
    } else {
      console.log("sandbox record current");
    }
  } finally {
    cleanup();
  }
}

await main();
