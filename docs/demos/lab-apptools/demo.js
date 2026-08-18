export const demo = {
  title: "Agent to UI",
  subtitle: "tools/list and tools/call in the host to app direction",
  maxHeight: 460,
  files: ["index.html"],
  host: {
    hostCapabilities: { logging: {}, message: { text: {} } },
    hostContext: {
      theme: "light", locale: "en-US", timeZone: "UTC",
      containerDimensions: { maxHeight: 440 },
    },
  },
  controls: [
    {
      label: "Agent: what can this view do?",
      run: async (host, demo) => {
        const { tools } = await host.listAppTools();
        demo.note("log", { level: "info",
          data: tools.map((t) => t.name).join(", ") });
      },
    },
    {
      label: "Agent: open the line items",
      run: (host) => host.callAppTool("show_panel", { panel: "items" }),
    },
    {
      label: "Agent: highlight the overage",
      run: (host) => host.callAppTool("highlight_line_item", { index: 3 }),
    },
    {
      label: "Agent: propose a reason",
      run: (host) => host.callAppTool("propose_reason", {
        text: "March overage credited: the customer was billed for 312 units "
            + "consumed during the incident window." }),
    },
    {
      label: "Agent: read the state back",
      run: async (host, demo) => {
        const result = await host.callAppTool("get_state", {});
        demo.note("log", { level: "info",
          data: JSON.stringify(result.structuredContent) });
      },
    },
  ],
};
