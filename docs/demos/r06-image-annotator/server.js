#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "../../lib/mcp-server.js";

const SELF = path.dirname(fileURLToPath(import.meta.url));

const BOXES = [
  { x: 112, y: 62, w: 62, h: 46, label: "scratch", colour: "#b4531a" },
  { x: 292, y: 172, w: 86, h: 38, label: "burr", colour: "#9b2226" },
];

serve({
  name: "cookbook-image-annotator",
  resourceUri: "ui://cookbook/image-annotator",
  viewFile: path.join(SELF, "index.html"),
  tools: {
    load_annotations: {
      description: "Load saved annotations for the plate.",
      annotations: { readOnlyHint: true },
      run: () => ({
        content: [{ type: "text", text: "Two saved regions: a scratch and a burr." }],
        structuredContent: { boxes: BOXES },
      }),
    },
    save_annotations: {
      description: "Save annotations back to the server.",
      inputSchema: { type: "object", properties: { boxes: { type: "array" } } },
      visibility: ["app"],
      run: ({ boxes = [] }) => ({
        content: [{ type: "text", text: `Saved ${boxes.length} regions.` }],
      }),
    },
  },
});
