export const demo = {
  title: "State ownership and conflict",
  subtitle: "three regions, three policies, one race",
  maxHeight: 500,
  files: ["index.html"],
  host: {
    hostCapabilities: { logging: {}, message: { text: {} } },
    hostContext: {
      theme: "light", locale: "en-US", timeZone: "UTC",
      containerDimensions: { maxHeight: 480 },
    },
  },
  controls: [
    { label: "Agent rewrites the summary",
      run: (host) => host.callAppTool("rewrite_summary", {
        text: "Renewal slipped to the 21st after the vendor patch was delayed." }) },
    { label: "Agent sets the risk score",
      run: (host) => host.callAppTool("set_risk", { score: 0.62 }) },
    { label: "Agent reads the internal note",
      run: async (host, demo) => {
        const result = await host.callAppTool("read_note", {});
        demo.note("log", { level: "info", data: result.content[0].text });
      } },
    { label: "Agent tries to write the note",
      run: async (host, demo) => {
        const result = await host.callAppTool("write_note", { text: "Sent." });
        demo.note("log", { level: "warning", data: result.content[0].text });
      } },
  ],
};
