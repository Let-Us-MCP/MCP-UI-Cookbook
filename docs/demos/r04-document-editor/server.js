#!/usr/bin/env node
/* Document Editor server. It holds the document, because the view cannot:
 * a sandboxed frame has an opaque origin and no storage worth the name, and
 * the extension has no message for saving view state. */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "../../lib/mcp-server.js";

const SELF = path.dirname(fileURLToPath(import.meta.url));

let document = "<p>The renewal is <strong>on track</strong> for the 14th. "
  + "Priya has the vendor patch in staging and expects to promote it on "
  + "Thursday.</p>";
let saves = 0;

serve({
  name: "cookbook-document-editor",
  resourceUri: "ui://cookbook/document-editor",
  viewFile: path.join(SELF, "index.html"),
  tools: {
    load_document: {
      description: "Load the current draft.",
      annotations: { readOnlyHint: true },
      run: () => ({
        content: [{ type: "text", text: document.replace(/<[^>]+>/g, "") }],
        structuredContent: { html: document },
      }),
    },
    save_document: {
      description: "Persist the draft. Called by the view, not by the model.",
      inputSchema: { type: "object", properties: { html: { type: "string" } },
                     required: ["html"] },
      visibility: ["app"],
      run: ({ html }) => {
        document = html;
        saves += 1;
        return { content: [{ type: "text",
          text: `Saved revision ${saves} at the server.` }] };
      },
    },
  },
});
