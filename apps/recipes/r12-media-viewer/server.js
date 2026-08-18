#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "../../lib/mcp-server.js";

const SELF = path.dirname(fileURLToPath(import.meta.url));

const CLIPS = [
  { id: "c1", title: "Assembly line, wide", seconds: 96, colour: "#1d2a35",
    shapes: [[0.3, 0.4, 0.16, "#4d7ea8"], [0.62, 0.55, 0.1, "#a8894d"]],
    captions: [ { at: 0, text: "The line runs at 40 units a minute." },
                { at: 20, text: "Station three is the constraint." } ] },
  { id: "c2", title: "Station three, close", seconds: 62, colour: "#2a2119",
    shapes: [[0.5, 0.5, 0.22, "#a8624d"], [0.2, 0.3, 0.08, "#d8c4a0"]],
    captions: [ { at: 0, text: "The gripper misses one in twelve." } ] },
  { id: "c3", title: "Night shift, wide", seconds: 140, colour: "#151a22",
    shapes: [[0.7, 0.35, 0.13, "#3f5f7a"], [0.35, 0.6, 0.18, "#26323d"]],
    captions: [ { at: 0, text: "Throughput holds without an operator." } ] },
];

serve({
  name: "cookbook-media-viewer",
  resourceUri: "ui://cookbook/media-viewer",
  viewFile: path.join(SELF, "index.html"),
  tools: {
    list_clips: {
      description: "List clips with durations and caption tracks.",
      annotations: { readOnlyHint: true },
      run: () => ({
        content: [{ type: "text", text:
          "Three clips totalling five minutes, each with captions." }],
        structuredContent: { clips: CLIPS },
      }),
    },
  },
});
