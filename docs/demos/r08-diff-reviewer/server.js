#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "../../lib/mcp-server.js";

const SELF = path.dirname(fileURLToPath(import.meta.url));

const HUNK = {
  file: "src/transport/retry.ts",
  lines: [
    { kind: "ctx", no: 41, text: "export function backoff(attempt: number) {" },
    { kind: "del", no: 42, text: "  const base = 100;" },
    { kind: "add", no: 42, text: "  const base = 250;" },
    { kind: "ctx", no: 43, text: "  const jitter = Math.random() * base;" },
    { kind: "del", no: 44, text: "  return base * 2 ** attempt + jitter;" },
    { kind: "add", no: 44, text: "  const capped = Math.min(base * 2 ** attempt, 30_000);" },
    { kind: "add", no: 45, text: "  return capped + jitter;" },
    { kind: "ctx", no: 46, text: "}" },
  ],
};

serve({
  name: "cookbook-diff-reviewer",
  resourceUri: "ui://cookbook/diff-reviewer",
  viewFile: path.join(SELF, "index.html"),
  tools: {
    load_diff: {
      description: "Load the hunk under review.",
      annotations: { readOnlyHint: true },
      run: () => ({
        content: [{ type: "text", text:
          "One hunk in src/transport/retry.ts: the base delay goes from 100ms "
          + "to 250ms and the backoff is capped at 30 seconds." }],
        structuredContent: { hunk: HUNK },
      }),
    },
  },
});
