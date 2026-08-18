const CITIES = {
  cities: [
    { name: "Oslo", temp: 11, sky: "cloud" },
    { name: "Bergen", temp: 9, sky: "rain" },
    { name: "Tromso", temp: 4, sky: "sleet" },
  ],
};

export const demo = {
  title: "Tool invocation and streaming",
  subtitle: "tool-input-partial, tool-input, tool-result, tool-cancelled",
  maxHeight: 460,
  files: ["index.html"],
  host: {
    hostCapabilities: { serverTools: { listChanged: true }, logging: {} },
    hostContext: {
      theme: "light", locale: "en-US", timeZone: "UTC",
      containerDimensions: { maxHeight: 440 },
    },
    serverTools: {
      refresh_weather: {
        descriptor: { name: "refresh_weather", description: "Refresh the table",
          inputSchema: { type: "object" },
          _meta: { ui: { visibility: ["app"] } } },
        delayMs: 250,
        result: { content: [{ type: "text", text: "Refreshed." }],
                  structuredContent: CITIES },
      },
      slow_lookup: {
        descriptor: { name: "slow_lookup", description: "Takes four seconds",
          inputSchema: { type: "object" } },
        delayMs: 4000,
        result: { content: [{ type: "text", text: "Finally." }],
                  structuredContent: CITIES },
      },
    },
  },

  controls: [
    {
      label: "Stream the tool input",
      run: async (host) => {
        host.sendPartialToolInput({ region: "Nor" });
        await new Promise((r) => setTimeout(r, 260));
        host.sendPartialToolInput({ region: "Nordics", units: "c" });
        await new Promise((r) => setTimeout(r, 260));
        host.sendToolInput({ region: "Nordics", units: "celsius" });
      },
    },
    {
      label: "Deliver the result",
      run: (host) => host.sendToolResult({
        content: [{ type: "text", text: "Oslo 11, Bergen 9, Tromso 4." }],
        structuredContent: CITIES,
      }),
    },
    {
      label: "Deliver a failure",
      run: (host) => host.sendToolResult({
        isError: true,
        content: [{ type: "text",
          text: "The weather service returned 503. The table is unchanged." }],
      }),
    },
    {
      label: "Cancel from the host",
      run: (host) => host.cancelTool("The user asked something else"),
    },
  ],
};
