#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "../../lib/mcp-server.js";

const SELF = path.dirname(fileURLToPath(import.meta.url));

let preferences = {
  digest: "08:30", from: "21:00", until: "07:00",
  email: "sam@meridian.example", accent: "#0f5c8c",
  density: "comfortable", renewal: "2026-09-14", motion: false,
};

serve({
  name: "cookbook-settings",
  resourceUri: "ui://cookbook/settings",
  viewFile: path.join(SELF, "index.html"),
  tools: {
    load_preferences: {
      description: "Load the user's notification and appearance preferences.",
      annotations: { readOnlyHint: true },
      run: () => ({
        content: [{ type: "text", text:
          `Digest at ${preferences.digest}, quiet hours ${preferences.from} `
          + `to ${preferences.until}.` }],
        structuredContent: { preferences },
      }),
    },
    save_preferences: {
      description: "Persist preferences. Called by the view.",
      inputSchema: { type: "object" },
      visibility: ["app"],
      run: (values) => {
        if (values.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(values.email)) {
          return { isError: true, content: [{ type: "text",
            text: "The server rejected the address. Nothing was saved." }] };
        }
        preferences = { ...preferences, ...values };
        return { content: [{ type: "text", text: "Preferences saved." }],
                 structuredContent: { preferences } };
      },
    },
  },
});
