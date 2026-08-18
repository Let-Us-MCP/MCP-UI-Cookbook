#!/usr/bin/env node
/* Dashboard server: the shared stdio server plus one tool. */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "../../lib/mcp-server.js";

const SELF = path.dirname(fileURLToPath(import.meta.url));

const series = (base, spread) =>
  Array.from({ length: 24 }, (_, i) =>
    Math.round(base + Math.sin(i / 3) * spread + (i % 5) * spread * 0.2));

const METRICS = [
  { key: "p95", label: "Checkout p95", value: 412, unit: "ms", state: "warn",
    note: "up 18% since the 4.18.2 deploy", series: series(400, 60),
    breakdown: [["p50", 120], ["p95", 412], ["p99", 1180], ["requests", 84210]] },
  { key: "errors", label: "Error rate", value: 143, unit: "/h", state: "bad",
    note: "billing 9.2.4 is the source", series: series(120, 40),
    breakdown: [["billing", 143], ["checkout", 17], ["search", 0]] },
  { key: "queue", label: "Queue depth", value: 38, unit: "jobs", state: "ok",
    note: "steady", series: series(40, 12),
    breakdown: [["ready", 30], ["retrying", 6], ["dead", 2]] },
  { key: "uptime", label: "Uptime", value: 99, unit: "%", state: "ok",
    note: "30 day window", series: series(99, 1),
    breakdown: [["incidents", 2], ["minutes lost", 41]] },
];

serve({
  name: "cookbook-dashboard",
  resourceUri: "ui://cookbook/dashboard",
  viewFile: path.join(SELF, "index.html"),
  tools: {
    service_health: {
      description: "Current service health metrics with 24 point history.",
      annotations: { readOnlyHint: true },
      run: () => ({
        content: [{ type: "text", text:
          "Checkout p95 is 412ms and error rate is 143/h, both driven by "
          + "billing 9.2.4. Queue depth and uptime are normal." }],
        structuredContent: { metrics: METRICS },
      }),
    },
  },
});
