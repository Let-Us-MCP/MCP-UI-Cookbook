export const demo = {
  title: "Persistence and history",
  subtitle: "undo you own, persistence you do not have",
  maxHeight: 500,
  files: ["index.html"],
  host: {
    hostCapabilities: { serverTools: {}, logging: {} },
    hostContext: {
      theme: "light", locale: "en-US", timeZone: "UTC",
      containerDimensions: { maxHeight: 480 },
    },
    serverTools: {
      save_view_state: {
        descriptor: { name: "save_view_state", description: "Persist view state",
          inputSchema: { type: "object" } },
        result: { content: [{ type: "text", text: "State saved on the server." }] },
      },
    },
  },
  controls: [
    {
      label: "Reload the view (state is gone)",
      run: (host, demo) => demo.reloadFrame(),
    },
  ],
};
