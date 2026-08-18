const fixtures = await fetch(new URL("fixtures.json", import.meta.url))
  .then((r) => r.json());

export const demo = {
  title: "Recipe 8: Code and Diff Reviewer",
  subtitle: "line selection as the unit of conversation",
  maxHeight: 500,
  files: ["index.html", "server.js", "fixtures.json"],
  host: {
    hostCapabilities: { serverTools: {}, openLinks: {}, message: { text: {} },
      updateModelContext: { text: {}, structuredContent: {} }, logging: {} },
    hostContext: { theme: "light", locale: "en-US", timeZone: "UTC",
      containerDimensions: { maxHeight: 480 } },
    serverTools: {
      load_diff: {
        descriptor: { name: "load_diff", description: "Load a hunk",
          inputSchema: { type: "object" } },
        result: () => fixtures.results.load_diff,
      },
    },
  },
  controls: [
    { label: "Refuse to open links",
      run: (host) => { delete host.hostCapabilities.openLinks; } },
    { label: "Show the model context",
      run: (host, demo) => demo.note("log", { level: "info",
        data: host.modelContext
          ? JSON.stringify(host.modelContext.structuredContent)
          : "Nothing published; select a line first." }) },
  ],
};
