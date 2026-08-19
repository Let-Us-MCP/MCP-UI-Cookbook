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

// A real 64x40 PNG, so the preview in the view is previewing an image and not
// a placeholder standing in for one. Small enough to inline; anything larger
// belongs behind `resources/read`, which is what `cover.png` demonstrates.
const COVER_PNG =
  + "iVBORw0KGgoAAAANSUhEUgAAAEAAAAAoCAIAAADBrGu+AAAAVElEQVR42u3PsQnA"
  + "IAAAQTfIgk4kdrYOYG3rci6QNEpA4eAH+Autj6sLAAAAAAAAAAAbgFTqa0/MR/X1"
  + "CQAAAADwD+CWAAAAAAAAAAAAAAAAAAAWm1GqLAAO6BMfAAAAAElFTkSuQmCC";

const CONTENTS = {
  q3: { mimeType: "text/markdown", text:
    "# Q3 review\n\nCheckout p95 moved from 412ms to 1290ms after the "
    + "billing migration.\n\n- Owner: platform-team\n- Status: open\n" },
  plan: { mimeType: "text/markdown", text:
    "# Plan\n\nMove the index volume before the renewal date.\n" },
  notes: { mimeType: "text/plain", text:
    "Ring the vendor about the staging key.\nThe grace period ends "
    + "tomorrow.\n" },
  cover: { mimeType: "image/png", blob: COVER_PNG },
};

serve({
  name: "cookbook-file-explorer",
  resourceUri: "ui://cookbook/file-explorer",
  viewFile: path.join(SELF, "index.html"),
  // Addressable as resources, so the view can read one through the host the
  // way it would read any server resource. A tool that returned the bytes
  // would work too; a resource is the right shape for something with a URI.
  resources: Object.fromEntries(Object.entries(CONTENTS).map(([id, c]) => [
    `file:///workspace/${id}`,
    { name: id, mimeType: c.mimeType,
      ...(c.text ? { text: c.text } : { blob: c.blob }) },
  ])),
  tools: {
    read_file: {
      description: "Read one file from the workspace for preview.",
      inputSchema: { type: "object",
        properties: { id: { type: "string" } }, required: ["id"] },
      annotations: { readOnlyHint: true },
      run: ({ id }) => {
        const found = CONTENTS[id];
        if (!found) {
          return { isError: true, content: [{ type: "text", text:
            `There is no file with id "${id}".` }] };
        }
        return {
          // The model gets a description; the view gets the bytes. A base64
          // image in the model's context is tokens spent on nothing it can
          // read.
          content: [{ type: "text", text:
            `${id} is ${found.mimeType}.` },
            { type: "resource_link", uri: `file:///workspace/${id}`,
              name: id, mimeType: found.mimeType }],
          structuredContent: { id, mimeType: found.mimeType,
                               text: found.text, blob: found.blob },
        };
      },
    },
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
