#!/usr/bin/env node
/* Screenshot a page from docs/ over the DevTools Protocol.
 *
 *   node tools/shoot.mjs how-to-read.html out.png [selector] [width]
 *
 * Used for eyeballing the built site during development, and by the figure
 * pipeline for the annotated renders that show a real application rather than
 * a drawing of one.
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = Number(process.env.PORT || 8978);
const CDP_PORT = Number(process.env.CDP_PORT || 9225);

const [page = "index.html", out = "shot.png", selector = "", widthArg] =
  process.argv.slice(2);
const WIDTH = Number(widthArg || 1100);

const CHROME = [
  process.env.CHROME,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
].filter(Boolean).find((c) => fs.existsSync(c));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try { const v = await fn(); if (v) return v; } catch { /* retry */ }
    if (Date.now() > deadline) throw new Error("timed out");
    await sleep(120);
  }
}

const server = spawn(process.execPath, [path.join(ROOT, "tools", "serve.mjs")], {
  env: { ...process.env, PORT: String(PORT), QUIET: "1" }, stdio: "ignore" });
const profile = fs.mkdtempSync(path.join(process.env.TMPDIR || "/tmp", "shot-"));
const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${CDP_PORT}`,
  `--user-data-dir=${profile}`, "--no-first-run", "--disable-gpu",
  "--hide-scrollbars", "--force-device-scale-factor=2",
  `--window-size=${WIDTH},1200`, "about:blank"], { stdio: "ignore" });

const done = (code) => {
  try { chrome.kill(); } catch { /* gone */ }
  try { server.kill(); } catch { /* gone */ }
  fs.rmSync(profile, { recursive: true, force: true });
  process.exit(code);
};

try {
  await waitFor(async () => (await fetch(`http://127.0.0.1:${PORT}/`)).ok);
  await waitFor(async () =>
    (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json());
  const target = await (await fetch(
    `http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: "PUT" })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));

  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", (event) => {
    const m = JSON.parse(event.data);
    const p = pending.get(m.id);
    if (!p) return;
    pending.delete(m.id);
    m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    pending.set(++id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride",
    { width: WIDTH, height: 1200, deviceScaleFactor: 2, mobile: false });
  const url = page.startsWith("http") ? page : `http://127.0.0.1:${PORT}/${page}`;
  await send("Page.navigate", { url });
  await sleep(1600);

  let clip;
  if (selector) {
    const r = await send("Runtime.evaluate", {
      expression: `(() => { const n = document.querySelector(${JSON.stringify(selector)});
        if (!n) return null; const r = n.getBoundingClientRect();
        return { x: r.x + scrollX, y: r.y + scrollY,
                 width: Math.ceil(r.width), height: Math.ceil(r.height) }; })()`,
      returnByValue: true });
    clip = r.result.value;
    if (!clip) throw new Error(`no element matches ${selector}`);
  }

  const shot = await send("Page.captureScreenshot", {
    format: "png", captureBeyondViewport: true,
    ...(clip ? { clip: { ...clip, scale: 1 } } : {}),
  });
  fs.writeFileSync(path.isAbsolute(out) ? out : path.join(ROOT, out), Buffer.from(shot.data, "base64"));
  console.log(`${out}  ${clip ? `${clip.width}x${clip.height}` : "full page"}`);
  done(0);
} catch (error) {
  console.error("shoot failed:", error.message);
  done(1);
}
