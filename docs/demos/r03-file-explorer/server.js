#!/usr/bin/env node
/* File Explorer server. The tree is a fixture rather than your disk, because
 * a book that ships a server which walks your filesystem is a book with a
 * security problem. */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "../../lib/mcp-server.js";

const SELF = path.dirname(fileURLToPath(import.meta.url));

const TREE = {
  id: "root", name: "/", children: [
    { id: "docs", name: "documents", children: [
      { id: "q3", name: "q3-review.md", size: 8213, modified: "2026-08-11" },
      { id: "plan", name: "plan.md", size: 4102, modified: "2026-08-17" },
    ] },
    { id: "img", name: "images", children: [
      { id: "cover", name: "cover.png", size: 402113, modified: "2026-07-30" },
    ] },
    { id: "notes", name: "notes.txt", size: 611, modified: "2026-08-18" },
  ],
};

serve({
  name: "cookbook-file-explorer",
  resourceUri: "ui://cookbook/file-explorer",
  viewFile: path.join(SELF, "index.html"),
  tools: {
    list_files: {
      description: "List the workspace tree.",
      annotations: { readOnlyHint: true },
      run: () => ({
        content: [{ type: "text", text:
          "Three top level entries: documents, images, notes.txt." }],
        structuredContent: { tree: TREE },
      }),
    },
  },
});
