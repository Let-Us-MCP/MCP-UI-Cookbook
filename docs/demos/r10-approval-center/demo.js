const fixtures = await fetch(new URL("fixtures.json", import.meta.url))
  .then((r) => r.json());

export const demo = {
  title: "Recipe 10: Approval Center",
  subtitle: "provenance, consent, and a tool interface that refuses to consent",
  tool: "pending_approvals",
  maxHeight: 560,
  files: ["index.html", "server.js", "../lib/mcp-server.js",
          "fixtures.json"],
  host: {
    hostCapabilities: { serverTools: {}, message: { text: {} },
      updateModelContext: { text: {}, structuredContent: {} }, logging: {} },
    hostContext: { theme: "light", locale: "en-US", timeZone: "America/New_York",
      containerDimensions: { maxHeight: 540 } },
    resources: {
      "ui://cookbook/approval-center":
        { href: new URL("index.html", import.meta.url).href },
    },
    serverTools: {
      pending_approvals: {
        descriptor: { name: "pending_approvals", description: "Pending actions",
          inputSchema: { type: "object" },
          _meta: { ui: { resourceUri: "ui://cookbook/approval-center" } } },
        result: () => fixtures.results.pending_approvals,
      },
    },
  },
  controls: [
    { label: "Agent queues a deletion",
      run: (host) => host.callAppTool("queue_approval", {
        id: "delete-dataset-19", title: "Delete dataset customers_2024",
        risk: "high", at: "2026-08-18T09:41:00Z",
        description: "Permanently delete 4.1 million rows and their backups.",
        consequence: "There is no restore path after the backup window closes.",
        question: "Who asked for this dataset to be deleted?",
        provenance: { "asked by": "the agent, following a retention rule",
          "on behalf of": "data-platform", tool: "warehouse.drop_dataset",
          arguments: "dataset=customers_2024 backups=true",
          "prior approvals": "none" } }) },
    { label: "Agent tries to approve it itself",
      run: async (host, demo) => {
        const result = await host.callAppTool("approve",
          { title: "Delete dataset customers_2024" });
        demo.note("log", { level: "warning", data: result.content[0].text }); } },
    { label: "Agent reads the decisions",
      run: async (host, demo) => {
        const result = await host.callAppTool("get_decisions", {});
        demo.note("log", { level: "info", data: result.content[0].text }); } },
  ],
};
