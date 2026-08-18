#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "../../lib/mcp-server.js";

const SELF = path.dirname(fileURLToPath(import.meta.url));

serve({
  name: "cookbook-agent-control",
  resourceUri: "ui://cookbook/agent-control",
  viewFile: path.join(SELF, "index.html"),
  tools: {
    run_task: {
      description: "Run a long task and report progress against it.",
      inputSchema: { type: "object", properties: { name: { type: "string" } },
                     required: ["name"] },
      run: async ({ name }, { progress }) => {
        const steps = ["reading manifest", "scanning segments",
                       "building index", "verifying", "writing"];
        for (const [i, step] of steps.entries()) {
          await new Promise((r) => setTimeout(r, 120));
          progress(i + 1, steps.length, step);
        }
        return {
          content: [{ type: "text", text: `${name} completed in 5 steps.` }],
          structuredContent: { name, steps: steps.length },
        };
      },
    },
    list_tasks: {
      description: "List tasks the server knows about.",
      annotations: { readOnlyHint: true },
      run: () => ({
        content: [{ type: "text", text: "Two shards are queued for reindexing." }],
        structuredContent: { tasks: [
          { name: "Reindex shard 1", state: "queued" },
          { name: "Reindex shard 2", state: "queued" },
        ] },
      }),
    },
  },
});
