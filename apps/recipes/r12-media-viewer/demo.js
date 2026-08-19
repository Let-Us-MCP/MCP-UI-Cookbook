const fixtures = await fetch(new URL("fixtures.json", import.meta.url))
  .then((r) => r.json());

export const demo = {
  title: "Recipe 12: Media Viewer",
  subtitle: "transport, captions, display modes, and a share button with no capability",
  tool: "list_clips",
  maxHeight: 520,
  files: ["index.html", "server.js", "../lib/mcp-server.js",
          "fixtures.json"],
  host: {
    hostCapabilities: { serverTools: {}, openLinks: {}, logging: {} },
    hostContext: { theme: "light", locale: "en-US", timeZone: "UTC",
      displayMode: "inline",
      availableDisplayModes: ["inline", "fullscreen"],
      containerDimensions: { maxHeight: 500 } },
    resources: {
      "ui://cookbook/media-viewer":
        { href: new URL("index.html", import.meta.url).href },
    },
    serverTools: {
      list_clips: {
        descriptor: { name: "list_clips", description: "List clips",
          inputSchema: { type: "object" },
          _meta: { ui: { resourceUri: "ui://cookbook/media-viewer" } } },
        result: () => fixtures.results.list_clips,
      },
    },
  },
  controls: [
    { label: "Offer picture in picture",
      run: (host) => host.patchContext({
        availableDisplayModes: ["inline", "fullscreen", "pip"] }) },
    { label: "Withdraw fullscreen",
      run: (host) => host.patchContext({ availableDisplayModes: ["inline"] }) },
    { label: "Refuse to open links",
      run: (host) => { delete host.hostCapabilities.openLinks; } },
  ],
};
