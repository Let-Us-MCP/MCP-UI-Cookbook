#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "../../lib/mcp-server.js";

const SELF = path.dirname(fileURLToPath(import.meta.url));

const GRAPH = {
  nodes: [
    { id: "t1", name: "Ticket opened", kind: "trigger", x: 40, y: 40 },
    { id: "a1", name: "Classify", kind: "action", x: 260, y: 40 },
    { id: "a2", name: "Assign owner", kind: "action", x: 480, y: 40 },
    { id: "o1", name: "Notify", kind: "output", x: 480, y: 150 },
  ],
  edges: [ { from: "t1", to: "a1" }, { from: "a1", to: "a2" } ],
};

serve({
  name: "cookbook-workflow-builder",
  resourceUri: "ui://cookbook/workflow-builder",
  viewFile: path.join(SELF, "index.html"),
  tools: {
    load_workflow: {
      description: "Load the triage workflow.",
      annotations: { readOnlyHint: true },
      run: () => ({
        content: [{ type: "text", text:
          "Four steps. Notify is disconnected, so the workflow is invalid." }],
        structuredContent: { graph: GRAPH },
      }),
    },
  },
});
