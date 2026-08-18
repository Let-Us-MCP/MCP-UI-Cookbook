const fixtures = await fetch(new URL("fixtures.json", import.meta.url))
  .then((r) => r.json());

export const demo = {
  title: "Recipe 2: Dashboard",
  subtitle: "tiles, sparklines, drill-down, and values that change under you",
  maxHeight: 520,
  files: ["index.html", "server.js", "fixtures.json"],
  host: {
    hostCapabilities: {
      serverTools: {}, updateModelContext: { text: {}, structuredContent: {} },
      logging: {},
    },
    hostContext: {
      theme: "light", locale: "en-US", timeZone: "America/New_York",
      displayMode: "inline", availableDisplayModes: ["inline", "fullscreen"],
      containerDimensions: { maxHeight: 500 },
    },
    serverTools: {
      service_health: {
        descriptor: { name: "service_health", description: "Health metrics",
          inputSchema: { type: "object" } },
        delayMs: 150,
        result: () => fixtures.results.service_health,
      },
    },
  },
  controls: [
    { label: "Push a fresh result",
      run: (host) => host.sendToolResult(fixtures.results.service_health) },
    { label: "Withdraw fullscreen",
      run: (host) => host.patchContext({ availableDisplayModes: ["inline"] }) },
    { label: "Show the model context",
      run: (host, demo) => demo.note("log", { level: "info",
        data: host.modelContext
          ? JSON.stringify(host.modelContext.structuredContent)
          : "Nothing published; open a tile first." }) },
  ],
};
