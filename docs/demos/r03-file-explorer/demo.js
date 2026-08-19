const fixtures = await fetch(new URL("fixtures.json", import.meta.url))
  .then((r) => r.json());

export const demo = {
  title: "Recipe 3: File Explorer",
  subtitle: "tree, context menu, drag to move, delete with undo",
  tool: "list_files",
  maxHeight: 500,
  files: ["index.html", "server.js", "../lib/mcp-server.js",
          "fixtures.json"],
  host: {
    hostCapabilities: { serverTools: {}, serverResources: {}, logging: {} },
    hostContext: {
      theme: "light", locale: "en-US", timeZone: "UTC",
      containerDimensions: { maxHeight: 480 },
      deviceCapabilities: { hover: true, touch: false },
    },
    resources: {
      "ui://cookbook/file-explorer":
        { href: new URL("index.html", import.meta.url).href },
    },
    serverTools: {
      list_files: {
        descriptor: { name: "list_files", description: "List the tree",
          inputSchema: { type: "object" },
          _meta: { ui: { resourceUri: "ui://cookbook/file-explorer" } } },
        result: () => fixtures.results.list_files,
      },
    },
  },
  controls: [],
};
