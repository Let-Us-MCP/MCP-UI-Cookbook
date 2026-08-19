const fixtures = await fetch(new URL("fixtures.json", import.meta.url))
  .then((r) => r.json());

let mode = "ok";

export const demo = {
  title: "Recipe 11: Agent Control Center",
  subtitle: "streaming input, progress, cancellation that tells the truth",
  tool: "run_task",
  maxHeight: 520,
  files: ["index.html", "server.js", "../lib/mcp-server.js",
          "fixtures.json"],
  host: {
    hostCapabilities: { serverTools: {}, logging: {} },
    hostContext: { theme: "light", locale: "en-US", timeZone: "UTC",
      containerDimensions: { maxHeight: 500 } },
    resources: {
      "ui://cookbook/agent-control":
        { href: new URL("index.html", import.meta.url).href,
          _meta: { ui: { csp: {}, prefersBorder: true } } },
    },
    serverTools: {
      run_task: {
        descriptor: { name: "run_task", description: "Run a task",
          inputSchema: { type: "object" },
          _meta: { ui: { resourceUri: "ui://cookbook/agent-control" } } },
        result: async (args, host) => {
          const steps = ["reading manifest", "scanning segments",
                         "building index", "verifying", "writing"];
          for (let i = 0; i < steps.length; i += 1) {
            await new Promise((r) => setTimeout(r, 420));
            host.notify("notifications/progress", { progressToken: 1,
              progress: i + 1, total: steps.length, message: steps[i] });
            if (mode === "fail" && i === 2) {
              return { isError: true, content: [{ type: "text",
                text: "Segment 41 is corrupt, so the index was not written. "
                    + "Retrying will start from the manifest again." }] };
            }
          }
          return fixtures.results.run_task;
        },
      },
    },
  },
  controls: [
    { label: "Agent streams a task in",
      run: async (host) => {
        host.sendPartialToolInput({ name: "Reindex sh" });
        await new Promise((r) => setTimeout(r, 300));
        host.sendPartialToolInput({ name: "Reindex shard 9" });
        await new Promise((r) => setTimeout(r, 300));
        host.sendToolInput({ name: "Reindex shard 9", priority: "high" });
      } },
    { label: "Make the next task fail", run: () => { mode = "fail"; } },
    { label: "Make tasks succeed", run: () => { mode = "ok"; } },
  ],
};
