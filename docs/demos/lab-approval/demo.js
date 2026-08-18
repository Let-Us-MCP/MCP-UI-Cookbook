export const demo = {
  title: "Approval and the context boundary",
  subtitle: "provenance, consent, and what the model is not told",
  maxHeight: 520,
  files: ["index.html"],
  host: {
    hostCapabilities: {
      message: { text: {} },
      updateModelContext: { text: {}, structuredContent: {} },
      logging: {},
    },
    hostContext: {
      theme: "light", locale: "en-US", timeZone: "UTC",
      containerDimensions: { maxHeight: 500 },
    },
  },
  controls: [
    {
      label: "Queue a refund for approval",
      run: (host) => host.callAppTool("queue_action", {
        id: "refund-8841",
        title: "refund",
        description: "Refund 1,240.00 to Meridian Systems against invoice 2026-0814.",
        consequence: "The money leaves today and cannot be recalled from here.",
        provenance: {
          "asked by": "the agent, in this conversation",
          "on behalf of": "sam@meridian.example",
          tool: "billing.refund",
          amount: "1,240.00 USD",
          "prior approvals": "none for this customer",
        },
      }),
    },
    {
      label: "Show what the model was told",
      run: (host, demo) => demo.note("log", { level: "info",
        data: host.modelContext
          ? JSON.stringify(host.modelContext.structuredContent)
          : "Nothing has been published to the model." }),
    },
  ],
};
