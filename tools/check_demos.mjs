#!/usr/bin/env node
/* Run every demo in a real browser and record what crossed the bridge.
 *
 * This is Layer 1 of the verification model in Part VI. Each demo is loaded in
 * headless Chrome, the handshake is awaited, every control on the page is
 * clicked, and the resulting JSON-RPC log is written to
 * `conformance/transcripts/<demo>.json`. A transcript that changes shows up in
 * the diff of a pull request, which is the only way a protocol regression
 * announces itself.
 *
 * A view with a syntax error is invisible from the outside: it never sends
 * `ui/initialize`, and the frame just sits there. So a missing handshake is a
 * failure here, not a warning.
 *
 *   node tools/check_demos.mjs            # all demos
 *   node tools/check_demos.mjs lab-surface
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DEMOS = path.join(ROOT, "docs", "demos");
const OUT = path.join(ROOT, "conformance", "transcripts");
const PORT = Number(process.env.PORT || 8977);
const CDP_PORT = Number(process.env.CDP_PORT || 9224);
const UPDATE = process.env.UPDATE_TRANSCRIPTS === "1";

const CHROME_CANDIDATES = [
  process.env.CHROME,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);

const findChrome = () => {
  for (const c of CHROME_CANDIDATES) if (fs.existsSync(c)) return c;
  throw new Error("no Chrome found; set CHROME=/path/to/chrome");
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, timeoutMs = 15000, everyMs = 100) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const value = await fn();
      if (value) return value;
    } catch { /* not ready */ }
    if (Date.now() > deadline) throw new Error("timed out");
    await sleep(everyMs);
  }
}

class Session {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.console = [];
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.method === "Runtime.consoleAPICalled"
          && ["error", "warning"].includes(message.params.type)) {
        this.console.push(message.params.args.map((a) => a.value ?? a.description)
          .join(" "));
      }
      if (message.method === "Runtime.exceptionThrown") {
        this.console.push("uncaught: "
          + message.params.exceptionDetails.exception?.description);
      }
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      message.error ? pending.reject(new Error(message.error.message))
                    : pending.resolve(message.result);
    });
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression, returnByValue: true, awaitPromise: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description
        ?? result.exceptionDetails.text);
    }
    return result.result.value;
  }
}

// Transcripts are compared across runs, so anything that varies between runs
// has to come out: timings, ids that count from a different starting point,
// and object key order.
function normalise(entry) {
  const { direction, message } = entry;
  return {
    direction,
    method: message.method ?? (message.error ? "error" : "result"),
    id: message.id ?? null,
    payload: sortKeys(message.params ?? message.result ?? message.error ?? null),
  };
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort()
      .map((k) => [k, sortKeys(value[k])]));
  }
  return value;
}

async function main() {
  const wanted = process.argv.slice(2);
  const ids = JSON.parse(fs.readFileSync(path.join(DEMOS, "index.json"), "utf8"))
    .filter((id) => (wanted.length ? wanted.includes(id) : true));
  if (!ids.length) {
    console.error("no demos to check; run make demos first");
    process.exit(1);
  }
  fs.mkdirSync(OUT, { recursive: true });

  const server = spawn(process.execPath, [path.join(ROOT, "tools", "serve.mjs")], {
    env: { ...process.env, PORT: String(PORT), QUIET: "1" }, stdio: "ignore",
  });
  const profile = fs.mkdtempSync(path.join(process.env.TMPDIR || "/tmp", "demo-"));
  const chrome = spawn(findChrome(), [
    "--headless=new",
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${profile}`,
    "--no-first-run", "--no-default-browser-check", "--disable-gpu",
    "--hide-scrollbars", "--window-size=900,900", "about:blank",
  ], { stdio: "ignore" });

  const cleanup = () => {
    try { chrome.kill(); } catch { /* already gone */ }
    try { server.kill(); } catch { /* already gone */ }
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* ok */ }
  };
  process.on("exit", cleanup);
  process.on("SIGINT", () => { cleanup(); process.exit(130); });

  await waitFor(async () => (await fetch(`http://127.0.0.1:${PORT}/`)).ok);
  await waitFor(async () =>
    (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json());

  let failures = 0;
  let changed = 0;

  for (const id of ids) {
    const target = await (await fetch(
      `http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: "PUT" })).json();
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener("open", r, { once: true }));
    const session = new Session(ws);
    await session.send("Page.enable");
    await session.send("Runtime.enable");
    await session.send("Page.navigate", {
      url: `http://127.0.0.1:${PORT}/demos/harness.html?demo=${encodeURIComponent(id)}`,
    });

    const problems = [];
    try {
      // The handshake, or nothing else matters.
      await waitFor(() => session.eval(
        `(() => { const rows = [...document.querySelectorAll('.demo-row .method')]
             .map(n => n.textContent);
           return rows.includes('ui/initialize')
             && rows.includes('ui/notifications/initialized'); })()`), 12000);

      // Then every button the demo offers, in order, with time to settle.
      const buttons = await session.eval(
        "document.querySelectorAll('.demo-controls .demo-button').length");
      for (let i = 0; i < buttons; i += 1) {
        const label = await session.eval(
          `document.querySelectorAll('.demo-controls .demo-button')[${i}].textContent`);
        if (label === "Reload view") continue;
        await session.eval(
          `document.querySelectorAll('.demo-controls .demo-button')[${i}].click()`);
        await sleep(220);
      }
      await sleep(300);

      const entries = await session.eval(
        `[...document.querySelectorAll('.demo-row')].map(row => ({
            direction: row.querySelector('.dir').textContent,
            message: JSON.parse(row.querySelector('code').textContent) }))`);
      const transcript = entries.map(normalise);

      const file = path.join(OUT, `${id}.json`);
      const body = JSON.stringify({ demo: id, messages: transcript }, null, 2) + "\n";
      if (!fs.existsSync(file)) {
        fs.writeFileSync(file, body);
        changed += 1;
      } else if (fs.readFileSync(file, "utf8") !== body) {
        if (UPDATE) {
          fs.writeFileSync(file, body);
          changed += 1;
        } else {
          problems.push("transcript differs from the recorded one "
            + "(UPDATE_TRANSCRIPTS=1 to accept)");
        }
      }

      const errors = session.console.filter((line) =>
        !/favicon|Failed to load resource/.test(line));
      if (errors.length) problems.push(...errors.slice(0, 3));
      console.log(`  ${id}: ${transcript.length} messages`
        + (problems.length ? "  FAILED" : ""));
    } catch (error) {
      problems.push(error.message);
      console.log(`  ${id}: ${error.message}  FAILED`);
    }

    for (const problem of problems) console.log(`      ${problem}`);
    if (problems.length) failures += 1;

    ws.close();
    await fetch(`http://127.0.0.1:${CDP_PORT}/json/close/${target.id}`)
      .catch(() => {});
  }

  console.log(`${ids.length} demos driven, ${changed} transcripts written, `
    + `${failures} failing`);
  cleanup();
  process.exit(failures ? 1 : 0);
}

main().catch((error) => {
  console.error("demo check failed:", error.message);
  process.exit(1);
});
