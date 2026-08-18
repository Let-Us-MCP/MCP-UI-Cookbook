// The fixture is recorded from server.js by tools/record_fixtures.mjs. It is
// not written by hand, and the recipe's tests fail if the two drift apart.
const fixtures = await fetch(new URL("fixtures.json", import.meta.url))
  .then((r) => r.json());

export const demo = {
  title: "Recipe 1: Data Explorer",
  subtitle: "sort, filter, page and select locally; escalate once, with structure",
  maxHeight: 540,
  files: ["index.html", "server.js", "fixtures.json"],

  host: {
    hostCapabilities: {
      serverTools: { listChanged: false },
      downloadFile: {},
      message: { text: {} },
      updateModelContext: { text: {}, structuredContent: {} },
      logging: {},
    },
    hostContext: {
      theme: "light", locale: "en-US", timeZone: "America/New_York",
      platform: "web", displayMode: "inline",
      availableDisplayModes: ["inline", "fullscreen"],
      containerDimensions: { maxHeight: 520 },
      deviceCapabilities: { hover: true, touch: false },
    },
    serverTools: {
      list_deployments: {
        descriptor: { name: "list_deployments", description: "List deployments",
          inputSchema: { type: "object" } },
        delayMs: 200,
        result: () => fixtures.results.list_deployments,
      },
      explain_deployment: {
        descriptor: { name: "explain_deployment",
          description: "Change log for one deployment",
          inputSchema: { type: "object" } },
        result: () => fixtures.results.explain_deployment,
      },
    },
  },

  controls: [
    {
      label: "Deliver the tool result",
      run: (host) => host.sendToolResult(fixtures.results.list_deployments),
    },
    {
      label: "Show what the model was told",
      run: (host, demo) => demo.note("log", { level: "info",
        data: host.modelContext
          ? JSON.stringify(host.modelContext.structuredContent)
          : "The view has published nothing yet. Select a row." }),
    },
    {
      label: "Break the server",
      run: (host) => {
        host.config.serverTools.list_deployments.result = () => ({
          isError: true,
          content: [{ type: "text",
            text: "The deployments service returned 503." }],
        });
      },
    },
    {
      label: "Fix the server",
      run: (host) => {
        host.config.serverTools.list_deployments.result =
          () => fixtures.results.list_deployments;
      },
    },
    {
      label: "Switch to ja-JP / Tokyo",
      run: (host) => host.patchContext({ locale: "ja-JP", timeZone: "Asia/Tokyo" }),
    },
  ],
};
