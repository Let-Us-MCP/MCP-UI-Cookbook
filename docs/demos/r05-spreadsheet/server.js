#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "../../lib/mcp-server.js";

const SELF = path.dirname(fileURLToPath(import.meta.url));

const CELLS = {
  A1: "Region", B1: "Units", C1: "Price", D1: "Revenue",
  A2: "North", B2: "1284", C2: "71", D2: "=B2*C2",
  A3: "South", B3: "932", C3: "69", D3: "=B3*C3",
  A4: "East", B4: "1601", C4: "74", D4: "=B4*C4",
  A5: "West", B5: "745", C5: "69", D5: "=B5*C5",
  A6: "Total", B6: "=SUM(B2:B5)", D6: "=SUM(D2:D5)",
};

serve({
  name: "cookbook-spreadsheet",
  resourceUri: "ui://cookbook/spreadsheet",
  viewFile: path.join(SELF, "index.html"),
  tools: {
    load_sheet: {
      description: "Load the revenue sheet.",
      annotations: { readOnlyHint: true },
      run: () => ({
        content: [{ type: "text", text:
          "Four regions with units and price; column D and row 6 are formulas." }],
        structuredContent: { cells: CELLS },
      }),
    },
  },
});
