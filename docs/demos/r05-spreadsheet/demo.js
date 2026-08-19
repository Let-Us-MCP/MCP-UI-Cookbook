const fixtures = await fetch(new URL("fixtures.json", import.meta.url))
  .then((r) => r.json());

export const demo = {
  title: "Recipe 5: Spreadsheet",
  subtitle: "range selection, a formula evaluator, and structured clipboard",
  tool: "load_sheet",
  maxHeight: 520,
  files: ["index.html", "server.js", "../lib/mcp-server.js",
          "fixtures.json"],
  host: {
    hostCapabilities: { serverTools: {}, logging: {} },
    hostContext: { theme: "light", locale: "en-US", timeZone: "UTC",
                   containerDimensions: { maxHeight: 500 } },
    resources: {
      "ui://cookbook/spreadsheet":
        { href: new URL("index.html", import.meta.url).href,
          _meta: { ui: { csp: {}, prefersBorder: true } } },
    },
    serverTools: {
      load_sheet: {
        descriptor: { name: "load_sheet", description: "Load the sheet",
          inputSchema: { type: "object" },
          _meta: { ui: { resourceUri: "ui://cookbook/spreadsheet" } } },
        result: () => fixtures.results.load_sheet,
      },
    },
  },
  controls: [],
};
