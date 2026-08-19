#!/usr/bin/env node
/* Render conformance: a real server, a real host, and assertions on pixels.
 *
 * Every other check in this repository verifies messages. This one verifies
 * the thing the book is actually about, and it is the only check that
 * exercises the whole chain:
 *
 *   1. Start the recipe's MCP server as a child process, over stdio.
 *   2. `initialize`, declaring the UI extension the way a host does.
 *   3. `tools/list`, and read `_meta.ui.resourceUri` off the tool.
 *   4. `resources/read` that URI. The HTML the view renders from comes out of
 *      the server here; nothing is read from `apps/` or `docs/`.
 *   5. Render it in a sandboxed iframe with a host emulator around it.
 *   6. `tools/call` the real tool, and deliver the real result as
 *      `ui/notifications/tool-input` and `ui/notifications/tool-result`.
 *   7. Assert on the DOM inside the frame.
 *   8. Run steps: click inside the view, call its registered tools, change the
 *      host context, and assert again.
 *
 * There is no model anywhere in that list. A host is the party that connects
 * to servers, renders surfaces and mediates privileged operations, and none of
 * those needs a model behind it. This harness is a host driven by a JSON file,
 * which is the same architecture as a host driven by a person.
 *
 * Reading into the frame is done over the DevTools Protocol rather than from
 * page script. Page script cannot: the frame has an opaque origin, which is
 * the property that stops a host reading a view. A debugger can, which is what
 * makes this testable without weakening the sandbox that ships.
 *
 *   node tools/check_render.mjs               # every case
 *   node tools/check_render.mjs r01-data-explorer
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CASES = path.join(ROOT, "conformance", "render");
// Vendored rather than installed: this repository has no npm dependencies and
// the audit should not be the thing that introduces one. MPL-2.0, licence
// alongside it.
const AXE_SOURCE = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "vendor", "axe.min.js"),
  "utf8");

// Rules that assume the thing under audit is a page. A view is a fragment
// rendered inside somebody else's document: the host owns the <main>, the
// landmarks and the heading outline, and a view that declared its own would be
// competing with them. Each of these is disabled with its reason rather than
// suppressed in a config nobody reads.
const PAGE_LEVEL_RULES = {
  "landmark-one-main":
    "the host's document owns <main>; a view declaring one adds a second",
  "page-has-heading-one":
    "the heading outline belongs to the conversation, not to one card in it",
  "region":
    "landmark regions are the host's; a view is content inside one of them",
  "html-has-lang":
    "the view's own <html lang> is set, but the host's document decides the "
    + "language a screen reader announces",
};

const PORT = Number(process.env.RENDER_PORT || 8985);
const CDP_PORT = Number(process.env.RENDER_CDP || 9235);
const PROTOCOL_VERSION = "2026-07-28";
const RESOURCE_MIME = "text/html;profile=mcp-app";

const CHROME = [
  process.env.CHROME,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean).find((c) => fs.existsSync(c));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try { const v = await fn(); if (v) return v; } catch { /* not ready */ }
    if (Date.now() > deadline) throw new Error("timed out");
    await sleep(120);
  }
}

// --- the MCP client half, over stdio --------------------------------------

class ServerConnection {
  constructor(scriptPath) {
    this.child = spawn(process.execPath, [scriptPath], {
      stdio: ["pipe", "pipe", "pipe"], cwd: ROOT });
    this.stderr = "";
    this.child.stderr.on("data", (d) => { this.stderr += d; });
    this.pending = new Map();
    this.onNotification = null;
    this.id = 0;
    let buffer = "";
    this.child.stdout.on("data", (chunk) => {
      buffer += chunk;
      let index;
      while ((index = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, index).trim();
        buffer = buffer.slice(index + 1);
        if (!line) continue;
        const message = JSON.parse(line);
        if (message.id === undefined && message.method) {
          this.onNotification?.(message);
          continue;
        }
        const waiter = this.pending.get(message.id);
        if (!waiter) continue;
        this.pending.delete(message.id);
        message.error ? waiter.reject(new Error(message.error.message))
                      : waiter.resolve(message.result);
      }
    });
  }

  request(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.child.stdin.write(
        `${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
      setTimeout(() => reject(new Error(`${method} timed out`)), 8000);
    });
  }

  // The host's own handshake. A host declares the UI extension here, and a
  // server is entitled to register different tools when it is absent.
  initialize() {
    return this.request("initialize", {
      protocolVersion: PROTOCOL_VERSION,
      clientInfo: { name: "cookbook-render-host", version: "1.0.0" },
      capabilities: {
        extensions: {
          "io.modelcontextprotocol/ui": { mimeTypes: [RESOURCE_MIME] },
        },
      },
    });
  }

  close() { try { this.child.kill(); } catch { /* already gone */ } }
}

// --- the CDP half ---------------------------------------------------------

class Browser {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.frameSession = null;
    this.console = [];
    ws.addEventListener("message", (event) => {
      const m = JSON.parse(event.data);
      if (m.method === "Target.attachedToTarget"
          && m.params.targetInfo.type === "iframe") {
        this.frameSession = m.params.sessionId;
      }
      if (m.method === "Runtime.bindingCalled" && m.params.name === "__mcpCall") {
        this.onServerCall?.(JSON.parse(m.params.payload));
      }
      if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
        this.console.push(m.params.args.map((a) => a.value ?? a.description)
          .join(" "));
      }
      if (m.method === "Runtime.exceptionThrown") {
        this.console.push("uncaught: "
          + m.params.exceptionDetails.exception?.description);
      }
      const waiter = this.pending.get(m.id);
      if (!waiter) return;
      this.pending.delete(m.id);
      m.error ? waiter.reject(new Error(m.error.message))
              : waiter.resolve(m.result);
    });
  }

  send(method, params = {}, sessionId) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify(
        { id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }

  async evalPage(expression) {
    const r = await this.send("Runtime.evaluate",
      { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.exception?.description
        ?? r.exceptionDetails.text);
    }
    return r.result.value;
  }

  // Inside the sandboxed frame. Page script cannot do this; a debugger can.
  async evalFrame(expression) {
    if (!this.frameSession) throw new Error("the view's frame never attached");
    const r = await this.send("Runtime.evaluate",
      { expression, returnByValue: true, awaitPromise: true },
      this.frameSession);
    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.exception?.description
        ?? r.exceptionDetails.text);
    }
    return r.result.value;
  }
}

// --- the page the host renders --------------------------------------------

const SHELL = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>render host</title>
<style>html,body{margin:0;background:#fff}iframe{display:block;width:900px;
border:0;height:600px}</style></head><body>
<iframe id="view" src="view/index.html" sandbox="allow-scripts"></iframe>
<script type="module">
import { HostEmulator } from "./host.js";
const config = await fetch("./config.json").then((r) => r.json());
const host = new HostEmulator(document.getElementById("view"), config.host, () => {});

// A host proxies the view's tool calls to the server it is connected to. This
// one has no server in the page, so it hands the call to the driver, which is
// holding the stdio connection to the real one.
const waiting = new Map();
let callId = 0;
window.__resolveServerCall = (id, result, error) => {
  const waiter = waiting.get(id);
  if (!waiter) return;
  waiting.delete(id);
  error ? waiter.reject(new Error(error)) : waiter.resolve(result);
};
host._callServerTool = (name, args) => new Promise((resolve, reject) => {
  const id = ++callId;
  waiting.set(id, { resolve, reject });
  window.__mcpCall(JSON.stringify({ id, name, arguments: args }));
});
host.onEvent = (event, params) => {
  if (event === "size" && params.height) {
    document.getElementById("view").style.height = params.height + "px";
  }
  if (event === "initialized") window.__ready = true;
};
// The host emulator answers the view; the driver answers the host, from the
// real server. Nothing here fabricates a result.
window.__host = host;
// Failure levers. A demonstration that only ever succeeds proves that the
// happy path works, which is the smaller half of what an application does.
window.__deny = (name) => { delete host.hostCapabilities[name]; };
window.__grant = (name) => { host.hostCapabilities[name] = {}; };
window.__teardown = (reason) => host.teardown(reason)
  .then((r) => { window.__teardownResult = r; })
  .catch((e) => { window.__teardownResult = { error: String(e.message) }; });
window.__errors = [];
addEventListener("unhandledrejection", (e) => {
  window.__errors.push(String(e.reason?.message ?? e.reason));
});
addEventListener("error", (e) => { window.__errors.push(String(e.message)); });
window.__forward = (message) => host._send(message, "host\u2192app");
window.__deliver = (result, args) => {
  if (args) host.sendToolInput(args);
  host.sendToolResult(result);
};
<\/script></body></html>
`;

// --- assertions -----------------------------------------------------------

function assertionScript(expect) {
  return `(() => {
    const out = [];
    for (const check of ${JSON.stringify(expect)}) {
      const nodes = [...document.querySelectorAll(check.selector)];
      const first = nodes[0];
      const text = (first?.textContent ?? "").replace(/\\s+/g, " ").trim();
      out.push({
        selector: check.selector,
        count: nodes.length,
        text,
        value: first && "value" in first ? first.value : undefined,
        attr: check.attr ? first?.getAttribute(check.attr.name) : undefined,
        noAttr: check.noAttr ? first?.hasAttribute(check.noAttr) : undefined,
        hidden: first ? first.hasAttribute("hidden")
          || getComputedStyle(first).display === "none" : null,
      });
    }
    return out;
  })()`;
}

function compare(expect, actual) {
  const problems = [];
  expect.forEach((check, i) => {
    const got = actual[i];
    const where = check.selector;
    if (check.count !== undefined && got.count !== check.count) {
      problems.push(`${where}: expected ${check.count} node(s), found ${got.count}`);
    }
    if (check.absent && got.count !== 0) {
      problems.push(`${where}: expected nothing, found ${got.count}`);
    }
    if (check.minCount !== undefined && got.count < check.minCount) {
      problems.push(`${where}: expected at least ${check.minCount}, found ${got.count}`);
    }
    if (check.text !== undefined && got.text !== check.text) {
      problems.push(`${where}: expected text ${JSON.stringify(check.text)}, `
        + `found ${JSON.stringify(got.text)}`);
    }
    if (check.textContains !== undefined && !got.text.includes(check.textContains)) {
      problems.push(`${where}: expected text containing `
        + `${JSON.stringify(check.textContains)}, found ${JSON.stringify(got.text)}`);
    }
    if (check.value !== undefined && got.value !== check.value) {
      problems.push(`${where}: expected value ${JSON.stringify(check.value)}, `
        + `found ${JSON.stringify(got.value)}`);
    }
    if (check.noAttr && got.noAttr !== false) {
      problems.push(`${where}: expected no ${check.noAttr} attribute, `
        + `found ${got.noAttr === undefined ? "no such node" : "one"}`);
    }
    if (check.attr && got.attr !== check.attr.value) {
      problems.push(`${where}: expected ${check.attr.name}=`
        + `${JSON.stringify(check.attr.value)}, found ${JSON.stringify(got.attr)}`);
    }
    if (check.hidden !== undefined && got.hidden !== check.hidden) {
      problems.push(`${where}: expected hidden=${check.hidden}, found ${got.hidden}`);
    }
  });
  return problems;
}

// --- one case -------------------------------------------------------------

async function runCase(spec, name, browser, workdir) {
  const problems = [];
  let failNext = null;
  const server = new ServerConnection(path.join(ROOT, spec.server));

  try {
    const init = await server.initialize();
    const ui = init?.capabilities?.extensions?.["io.modelcontextprotocol/ui"];
    if (!ui) problems.push("server did not declare io.modelcontextprotocol/ui");
    if (!ui?.mimeTypes?.includes(RESOURCE_MIME)) {
      problems.push(`server did not offer ${RESOURCE_MIME}`);
    }

    const { tools } = await server.request("tools/list", {});
    const tool = tools.find((t) => t.name === spec.tool);
    if (!tool) throw new Error(`server has no tool ${spec.tool}`);
    const resourceUri = tool._meta?.ui?.resourceUri;
    if (!resourceUri) throw new Error(`${spec.tool} has no _meta.ui.resourceUri`);

    const read = await server.request("resources/read", { uri: resourceUri });
    const content = read.contents?.[0];
    if (content?.mimeType !== RESOURCE_MIME) {
      problems.push(`resource mimeType is ${content?.mimeType}, `
        + `expected ${RESOURCE_MIME}`);
    }
    if (!content?.text?.includes("<!doctype html>")) {
      problems.push("resource content is not an HTML document");
    }
    if (content?._meta?.ui?.csp === undefined) {
      problems.push("resource declares no _meta.ui.csp, not even an empty one");
    }

    // Everything the frame loads comes from the server's own resource content.
    fs.mkdirSync(path.join(workdir, "view"), { recursive: true });
    fs.writeFileSync(path.join(workdir, "view", "index.html"), content.text);
    fs.writeFileSync(path.join(workdir, "config.json"),
      JSON.stringify({ host: spec.host ?? {} }));

    // Forward every tool call the view makes to the server that is running.
    browser.onServerCall = async ({ id, name, arguments: args }) => {
      if (failNext) {
        const injected = failNext;
        failNext = null;
        if (injected.reject) {
          await browser.evalPage(
            `window.__resolveServerCall(${id}, null, `
            + `${JSON.stringify(injected.reject)})`);
        } else {
          await browser.evalPage(
            `window.__resolveServerCall(${id}, `
            + `${JSON.stringify(injected)}, null)`);
        }
        return;
      }
      try {
        const proxied = await server.request("tools/call",
          { name, arguments: args ?? {}, _meta: { progressToken: 1 } });
        await browser.evalPage(
          `window.__resolveServerCall(${id}, ${JSON.stringify(proxied)}, null)`);
      } catch (error) {
        await browser.evalPage(
          `window.__resolveServerCall(${id}, null, `
          + `${JSON.stringify(String(error.message))})`);
      }
    };

    await browser.send("Page.navigate", { url: `http://127.0.0.1:${PORT}/shell.html` });
    await browser.send("Runtime.addBinding", { name: "__mcpCall" });
    await waitFor(() => browser.evalPage("window.__ready === true"), 12000);

    // An unhandled rejection inside the view is a defect that every DOM
    // assertion can still pass around, and a refused capability is exactly
    // where one hides. The listener has to be in the frame, because that is
    // the realm the view's promises reject in.
    await browser.evalFrame(`(() => {
      window.__errors = [];
      addEventListener("unhandledrejection", (e) => {
        window.__errors.push(String(e.reason?.message ?? e.reason));
      });
      addEventListener("error", (e) => { window.__errors.push(String(e.message)); });
      return true;
    })()`);

    // Forward anything the server volunteers, which is what a host does with
    // progress notifications against a running request.
    server.onNotification = (message) => {
      browser.evalPage(
        `window.__forward(${JSON.stringify(message)})`).catch(() => {});
    };

    const result = await server.request("tools/call",
      { name: spec.tool, arguments: spec.arguments ?? {},
        _meta: { progressToken: 1 } });
    if (spec.expectToolText
        && !result.content?.[0]?.text?.includes(spec.expectToolText)) {
      problems.push(`tool text did not contain `
        + `${JSON.stringify(spec.expectToolText)}`);
    }

    await browser.evalPage(
      `window.__deliver(${JSON.stringify(result)}, `
      + `${JSON.stringify(spec.arguments ?? {})})`);
    await sleep(spec.settleMs ?? 500);

    for (const [i, step] of (spec.steps ?? []).entries()) {
      const label = step.label ?? `step ${i + 1}`;
      // Take a capability away mid-session. The view's own copy of
      // `hostCapabilities` is whatever arrived at initialize, so this tests
      // the other half: what happens when the request is refused.
      if (step.deny) {
        await browser.evalPage(`window.__deny(${JSON.stringify(step.deny)})`);
      }
      if (step.grant) {
        await browser.evalPage(`window.__grant(${JSON.stringify(step.grant)})`);
      }
      // Make the next tool call the view issues fail, either as a JSON-RPC
      // error or as a well-formed result carrying isError.
      if (step.failNextCall !== undefined) {
        failNext = step.failNextCall;
      }
      if (step.teardown) {
        await browser.evalPage(`window.__teardown(${JSON.stringify(step.teardown)})`);
      }
      if (step.click) {
        await browser.evalFrame(
          `document.querySelector(${JSON.stringify(step.click)}).click()`);
      }
      // A keyboard route that no test drives is a keyboard route nobody knows
      // is broken. `keys` focuses a target and dispatches real KeyboardEvents
      // into the sandboxed frame, so Recipes 6 and 7 are exercised the way a
      // keyboard user exercises them.
      if (step.keys) {
        const target = step.keysTarget ?? ":focus";
        await browser.evalFrame(
          `(() => {
             const el = document.querySelector(${JSON.stringify(target)});
             if (!el) throw new Error("no key target " + ${JSON.stringify(target)});
             el.focus();
             for (const spec of ${JSON.stringify(step.keys)}) {
               const key = typeof spec === "string" ? spec : spec.key;
               const init = { key, code: key, bubbles: true, cancelable: true,
                              shiftKey: !!(spec.shiftKey), ctrlKey: !!(spec.ctrlKey),
                              metaKey: !!(spec.metaKey) };
               (document.activeElement ?? el).dispatchEvent(
                 new KeyboardEvent("keydown", init));
               (document.activeElement ?? el).dispatchEvent(
                 new KeyboardEvent("keyup", init));
             }
             return true;
           })()`);
      }
      if (step.appTool) {
        await browser.evalPage(
          `window.__host.callAppTool(${JSON.stringify(step.appTool)}, `
          + `${JSON.stringify(step.arguments ?? {})})`);
      }
      if (step.patchContext) {
        await browser.evalPage(
          `window.__host.patchContext(${JSON.stringify(step.patchContext)})`);
      }
      await sleep(step.settleMs ?? 350);
      // An unhandled rejection is a defect even when every assertion passes,
      // and a refused capability is exactly where one hides.
      const thrown = await browser.evalFrame(
        "JSON.stringify(window.__errors ?? [])");
      const list = JSON.parse(thrown || "[]");
      if (list.length) {
        problems.push(`${label}: page reported ${list.length} unhandled `
          + `error(s), first is ${JSON.stringify(list[0])}`);
        await browser.evalFrame("window.__errors.length = 0");
      }
      // Evaluate an expression inside the view and compare it. For pure
      // helpers this is the only honest test: the fixtures are realistic, so
      // they never contain the value that breaks the function, and a helper
      // that is only ever called with safe input is a helper nobody has
      // tested.
      if (step.evalExpect) {
        for (const check of step.evalExpect) {
          const got = await browser.evalFrame(
            `JSON.stringify(${check.expression})`);
          const actual = JSON.parse(got ?? "null");
          if (actual !== check.equals) {
            problems.push(`${label}: ${check.expression} gave `
              + `${JSON.stringify(actual)}, expected ${JSON.stringify(check.equals)}`);
          }
        }
      }
      if (step.expectMessage) {
        const want = step.expectMessage;
        const log = JSON.parse(await browser.evalPage(
          `JSON.stringify((window.__host.transcript || [])
             .filter(e => e.direction === "app\u2192host")
             .map(e => e.message))`));
        const found = log.filter((m) => m.method === want.method);
        if (!found.length) {
          problems.push(`${label}: no ${want.method} reached the host; `
            + `the view sent ${log.map((m) => m.method).filter(Boolean).join(", ") || "nothing"}`);
        } else if (want.contains) {
          const body = JSON.stringify(found[found.length - 1]);
          for (const needle of want.contains) {
            if (!body.includes(needle)) {
              problems.push(`${label}: ${want.method} did not carry `
                + `${JSON.stringify(needle)}; it was ${body.slice(0, 220)}`);
            }
          }
        }
        if (want.count !== undefined && found.length !== want.count) {
          problems.push(`${label}: expected ${want.count} ${want.method}, `
            + `found ${found.length}`);
        }
      }
      if (step.expect) {
        const actual = await browser.evalFrame(assertionScript(step.expect));
        problems.push(...compare(step.expect, actual)
          .map((p) => `${label}: ${p}`));
      }
    }

    // Layer 3, in the same run. The recipes' accessibility claims came from a
    // checklist applied by hand, which is worth having and is not evidence.
    // axe-core is evidence for the part it can see, and the part it cannot
    // see is still walked by hand and recorded per recipe.
    //
    // It runs after the steps rather than on load, so the audit sees the
    // interface the interactions produced, which is where the defects are.
    if (!process.env.RENDER_SKIP_AXE) {
      await browser.evalFrame(AXE_SOURCE + "\n;true");
      const raw = await browser.evalFrame(`(async () => {
        const run = await axe.run(document, {
          resultTypes: ["violations"],
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a",
                                           "wcag21aa", "wcag22aa", "best-practice"] },
        });
        return JSON.stringify(run.violations.map((v) => ({
          id: v.id, impact: v.impact, help: v.help,
          nodes: v.nodes.slice(0, 3).map((n) => n.target.join(" ")),
        })));
      })()`);
      const violations = JSON.parse(raw || "[]");
      const allowed = new Set(Object.keys(spec.axeAllow ?? {}));
      for (const v of violations) {
        if (v.id in PAGE_LEVEL_RULES) continue;
        if (allowed.has(v.id)) continue;
        problems.push(`axe ${v.id} (${v.impact}): ${v.help} at `
          + `${v.nodes.join(", ")}`);
      }
      // An allowance for a rule that no longer fires is an allowance that has
      // become a lie, so it fails too.
      for (const id of allowed) {
        if (!violations.some((v) => v.id === id)) {
          problems.push(`axeAllow lists ${id}, which no longer fires; remove it`);
        }
      }
      axeChecked += 1;
    }

    const errors = browser.console.filter((line) =>
      !/favicon|Failed to load resource/.test(line));
    problems.push(...errors.slice(0, 3).map((e) => `console: ${e}`));
    browser.console.length = 0;
  } catch (error) {
    problems.push(error.message);
    if (server.stderr) problems.push(`server stderr: ${server.stderr.slice(0, 200)}`);
  } finally {
    server.close();
  }
  return problems;
}

// --- main -----------------------------------------------------------------

let axeChecked = 0;

async function main() {
  if (!CHROME) {
    console.error("no Chrome found; set CHROME=/path/to/chrome");
    process.exit(1);
  }
  const wanted = process.argv.slice(2);
  const files = fs.readdirSync(CASES).filter((f) => f.endsWith(".json"))
    .filter((f) => (wanted.length ? wanted.includes(path.basename(f, ".json")) : true))
    .sort();
  if (!files.length) {
    console.error("no render cases matched");
    process.exit(1);
  }

  const workdir = fs.mkdtempSync(path.join(os.tmpdir(), "render-"));
  fs.writeFileSync(path.join(workdir, "shell.html"), SHELL);
  fs.copyFileSync(path.join(ROOT, "emulator", "host.js"),
                  path.join(workdir, "host.js"));
  fs.cpSync(path.join(ROOT, "apps", "lib"), path.join(workdir, "lib"),
            { recursive: true });
  fs.copyFileSync(path.join(ROOT, "emulator", "app-bridge.js"),
                  path.join(workdir, "lib", "app-bridge.js"));

  const TYPES = { ".html": "text/html; charset=utf-8",
                  ".js": "text/javascript; charset=utf-8",
                  ".css": "text/css; charset=utf-8",
                  ".json": "application/json; charset=utf-8" };
  const httpServer = http.createServer((req, res) => {
    const file = path.join(workdir, decodeURIComponent(req.url.split("?")[0]));
    if (!file.startsWith(workdir) || !fs.existsSync(file)) {
      res.writeHead(404).end("not found");
      return;
    }
    res.writeHead(200, { "content-type":
      TYPES[path.extname(file)] ?? "application/octet-stream",
      "cache-control": "no-store" });
    fs.createReadStream(file).pipe(res);
  }).listen(PORT);

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "render-profile-"));
  const chrome = spawn(CHROME, [
    "--headless=new", `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${profile}`, "--no-first-run", "--disable-gpu",
    "--hide-scrollbars", "--window-size=960,700", "about:blank",
  ], { stdio: "ignore" });

  const cleanup = () => {
    try { chrome.kill(); } catch { /* gone */ }
    try { httpServer.close(); } catch { /* gone */ }
    try { fs.rmSync(workdir, { recursive: true, force: true }); } catch { /* ok */ }
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* ok */ }
  };
  process.on("exit", cleanup);
  process.on("SIGINT", () => { cleanup(); process.exit(130); });

  await waitFor(async () =>
    (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json());
  const target = await (await fetch(
    `http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: "PUT" })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  const browser = new Browser(ws);
  await browser.send("Target.setAutoAttach",
    { autoAttach: true, waitForDebuggerOnStart: false, flatten: true });
  await browser.send("Page.enable");
  await browser.send("Runtime.enable");

  let failures = 0;
  let assertions = 0;
  for (const file of files) {
    const name = path.basename(file, ".json");
    const spec = JSON.parse(fs.readFileSync(path.join(CASES, file), "utf8"));
    browser.frameSession = null;
    const problems = await runCase(spec, name, browser, workdir);
    const count = (spec.steps ?? []).reduce(
      (n, s) => n + (s.expect?.length ?? 0) + (s.evalExpect?.length ?? 0)
        + (s.expectMessage ? 1 : 0), 0);
    assertions += count;
    console.log(`  ${name}: ${count} assertion(s) on rendered output`
      + (problems.length ? "  FAILED" : ""));
    for (const problem of problems) console.log(`      ${problem}`);
    if (problems.length) failures += 1;
  }

  console.log(`${files.length} case(s), ${assertions} assertion(s) against real `
    + `servers, ${axeChecked} audited by axe-core, ${failures} failing`);
  cleanup();
  process.exit(failures ? 1 : 0);
}

main().catch((error) => {
  console.error("render check failed:", error.message);
  process.exit(1);
});
