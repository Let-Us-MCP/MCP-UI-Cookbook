const fixtures = await fetch(new URL("fixtures.json", import.meta.url))
  .then((r) => r.json());

export const demo = {
  title: "Recipe 13: Settings and Preferences",
  subtitle: "pickers, validation that waits, save and discard, and a dirty guard",
  tool: "load_preferences",
  maxHeight: 620,
  files: ["index.html", "server.js", "../lib/mcp-server.js",
          "fixtures.json"],
  host: {
    hostCapabilities: { serverTools: {}, logging: {} },
    hostContext: { theme: "light", locale: "en-GB", timeZone: "Europe/London",
      containerDimensions: { maxHeight: 600 },
      deviceCapabilities: { hover: true, touch: false } },
    resources: {
      "ui://cookbook/settings":
        { href: new URL("index.html", import.meta.url).href },
    },
    serverTools: {
      load_preferences: {
        descriptor: { name: "load_preferences", description: "Load preferences",
          inputSchema: { type: "object" },
          _meta: { ui: { resourceUri: "ui://cookbook/settings" } } },
        result: () => fixtures.results.load_preferences,
      },
      save_preferences: {
        descriptor: { name: "save_preferences", description: "Save preferences",
          inputSchema: { type: "object" },
          _meta: { ui: { visibility: ["app"] } } },
        delayMs: 250,
        result: (args) => (args.email
          && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(args.email)
          ? fixtures.results.save_rejected
          : { content: [{ type: "text", text: "Preferences saved." }] }),
      },
    },
  },
  controls: [
    { label: "Switch to ja-JP / Tokyo",
      run: (host) => host.patchContext({ locale: "ja-JP", timeZone: "Asia/Tokyo" }) },
    { label: "Switch to a touch device",
      run: (host) => host.patchContext({
        deviceCapabilities: { touch: true, hover: false } }) },
    { label: "Close with unsaved changes",
      run: async (host, demo) => {
        await host.teardown("The user navigated away");
        demo.frame.style.opacity = "0.35"; } },
  ],
};
