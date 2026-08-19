const fixtures = await fetch(new URL("fixtures.json", import.meta.url))
  .then((r) => r.json());

let seed = 100;
const more = (n) => {
  const base = fixtures.results.tail_logs.structuredContent.lines;
  return Array.from({ length: n }, (_, i) => {
    const source = base[(seed + i) % base.length];
    return { ...source, id: `s${seed}-${i}` };
  });
};

export const demo = {
  title: "Recipe 9: Monitoring Console",
  subtitle: "sustained streaming, selection that survives it, honest connectivity",
  tool: "tail_logs",
  maxHeight: 480,
  files: ["index.html", "server.js", "../lib/mcp-server.js",
          "fixtures.json"],
  host: {
    hostCapabilities: { serverTools: {}, logging: {},
      updateModelContext: { text: {}, structuredContent: {} } },
    hostContext: { theme: "light", locale: "en-US", timeZone: "UTC",
      containerDimensions: { maxHeight: 460 } },
    resources: {
      "ui://cookbook/monitoring-console":
        { href: new URL("index.html", import.meta.url).href },
    },
    serverTools: {
      tail_logs: {
        descriptor: { name: "tail_logs", description: "Tail the log",
          inputSchema: { type: "object" },
          _meta: { ui: { resourceUri: "ui://cookbook/monitoring-console" } } },
        result: () => fixtures.results.tail_logs,
      },
    },
  },
  controls: [
    { label: "Stream 40 more lines",
      run: async (host) => {
        for (let i = 0; i < 8; i += 1) {
          seed += 5;
          host.sendToolResult({ content: [{ type: "text", text: "5 more lines." }],
            structuredContent: { lines: more(5) } });
          await new Promise((r) => setTimeout(r, 180));
        }
      } },
    { label: "Deliver one batch",
      run: (host) => { seed += 5; host.sendToolResult({
        content: [{ type: "text", text: "5 more lines." }],
        structuredContent: { lines: more(5) } }); } },
  ],
};
