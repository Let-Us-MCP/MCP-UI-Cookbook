const fixtures = await fetch(new URL("fixtures.json", import.meta.url))
  .then((r) => r.json());

export const demo = {
  title: "Recipe 5: Spreadsheet",
  subtitle: "range selection, a formula evaluator, and structured clipboard",
  maxHeight: 520,
  files: ["index.html", "server.js", "fixtures.json"],
  host: {
    hostCapabilities: { serverTools: {}, logging: {} },
    hostContext: { theme: "light", locale: "en-US", timeZone: "UTC",
                   containerDimensions: { maxHeight: 500 } },
    serverTools: {
      load_sheet: {
        descriptor: { name: "load_sheet", description: "Load the sheet",
          inputSchema: { type: "object" } },
        result: () => fixtures.results.load_sheet,
      },
    },
  },
  controls: [],
};
