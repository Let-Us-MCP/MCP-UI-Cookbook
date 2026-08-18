#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "../../lib/mcp-server.js";

const SELF = path.dirname(fileURLToPath(import.meta.url));

const REQUESTS = [
  {
    id: "refund-8841", title: "Refund 1,240.00 USD", risk: "high",
    at: "2026-08-18T09:12:00Z",
    description: "Refund invoice 2026-0814 to Meridian Systems in full.",
    consequence: "The money leaves today and cannot be recalled from here.",
    question: "Which invoices does this refund cover?",
    provenance: {
      "asked by": "the agent, in this conversation",
      "on behalf of": "sam@meridian.example",
      tool: "billing.refund",
      arguments: "invoice=2026-0814 amount=1240.00 currency=USD",
      "prior approvals": "none for this customer",
    },
  },
  {
    id: "rotate-7", title: "Rotate the staging API key", risk: "medium",
    at: "2026-08-18T08:41:00Z",
    description: "Issue a new staging key and revoke the current one in 24 hours.",
    consequence: "Anything still using the old key stops working tomorrow.",
    question: "What is still using the current staging key?",
    provenance: {
      "asked by": "the agent, following a scheduled policy check",
      "on behalf of": "platform-team",
      tool: "identity.rotate_key",
      arguments: "scope=staging grace=24h",
      "prior approvals": "3 in the last 90 days",
    },
  },
];

serve({
  name: "cookbook-approval-center",
  resourceUri: "ui://cookbook/approval-center",
  viewFile: path.join(SELF, "index.html"),
  tools: {
    pending_approvals: {
      description: "List actions waiting for human approval.",
      annotations: { readOnlyHint: true },
      run: () => ({
        content: [{ type: "text", text:
          "Two actions are waiting: a 1,240.00 USD refund and a staging key "
          + "rotation." }],
        structuredContent: { requests: REQUESTS },
      }),
    },
  },
});
