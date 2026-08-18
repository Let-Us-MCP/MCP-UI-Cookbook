#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "../../lib/mcp-server.js";

const SELF = path.dirname(fileURLToPath(import.meta.url));

const SERVICES = ["checkout", "billing", "search", "notifications"];
const MESSAGES = [
  ["info", "handled request in 41ms"],
  ["info", "cache hit ratio 0.94"],
  ["warn", "retrying upstream after 503"],
  ["err", "connection reset by peer"],
  ["info", "flushed 128 events"],
];

const batch = (n, seed = 0) => Array.from({ length: n }, (_, i) => {
  const [level, text] = MESSAGES[(i + seed) % MESSAGES.length];
  return {
    id: `l${seed}-${i}`,
    at: new Date(Date.UTC(2026, 7, 18, 9, 30, (i * 7) % 60))
      .toISOString().slice(11, 19),
    service: SERVICES[(i + seed) % SERVICES.length],
    level, text,
  };
});

serve({
  name: "cookbook-monitoring-console",
  resourceUri: "ui://cookbook/monitoring-console",
  viewFile: path.join(SELF, "index.html"),
  tools: {
    tail_logs: {
      description: "Return the most recent log lines.",
      annotations: { readOnlyHint: true },
      run: () => ({
        content: [{ type: "text", text:
          "24 recent lines across four services, including one connection "
          + "reset from billing." }],
        structuredContent: { lines: batch(24) },
      }),
    },
  },
});
