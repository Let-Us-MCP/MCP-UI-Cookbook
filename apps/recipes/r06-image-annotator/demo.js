const fixtures = await fetch(new URL("fixtures.json", import.meta.url))
  .then((r) => r.json());

export const demo = {
  title: "Recipe 6: Image Annotator",
  subtitle: "pointer capture, zoom about the cursor, dropzone, export",
  tool: "load_annotations",
  maxHeight: 520,
  files: ["index.html", "server.js", "../lib/mcp-server.js",
          "fixtures.json"],
  host: {
    hostCapabilities: { serverTools: {}, downloadFile: {}, logging: {} },
    hostContext: {
      theme: "light", locale: "en-US", timeZone: "UTC",
      displayMode: "inline", availableDisplayModes: ["inline", "fullscreen"],
      containerDimensions: { maxHeight: 500 },
    },
    resources: {
      "ui://cookbook/image-annotator":
        { href: new URL("index.html", import.meta.url).href,
          _meta: { ui: { csp: {}, prefersBorder: true } } },
    },
    serverTools: {
      load_annotations: {
        descriptor: { name: "load_annotations", description: "Load boxes",
          inputSchema: { type: "object" },
          _meta: { ui: { resourceUri: "ui://cookbook/image-annotator" } } },
        result: () => fixtures.results.load_annotations,
      },
    },
  },
  controls: [
    { label: "Refuse downloads",
      run: (host, demo) => { delete host.hostCapabilities.downloadFile;
                             demo.reloadFrame(); } },
  ],
};
