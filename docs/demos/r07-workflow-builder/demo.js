const fixtures = await fetch(new URL("fixtures.json", import.meta.url))
  .then((r) => r.json());

export const demo = {
  title: "Recipe 7: Workflow Builder",
  subtitle: "a node graph the agent can edit, one undoable step at a time",
  tool: "load_workflow",
  maxHeight: 520,
  files: ["index.html", "server.js", "../lib/mcp-server.js",
          "fixtures.json"],
  host: {
    hostCapabilities: { serverTools: {}, logging: {} },
    hostContext: { theme: "light", locale: "en-US", timeZone: "UTC",
                   containerDimensions: { maxHeight: 500 } },
    resources: {
      "ui://cookbook/workflow-builder":
        { href: new URL("index.html", import.meta.url).href,
          _meta: { ui: { csp: {}, prefersBorder: true } } },
    },
    serverTools: {
      load_workflow: {
        descriptor: { name: "load_workflow", description: "Load the graph",
          inputSchema: { type: "object" },
          _meta: { ui: { resourceUri: "ui://cookbook/workflow-builder" } } },
        result: () => fixtures.results.load_workflow,
      },
    },
  },
  controls: [
    { label: "Agent: what is wrong with this?",
      run: async (host, demo) => {
        const result = await host.callAppTool("get_workflow", {});
        demo.note("log", { level: "info", data: result.content[0].text }); } },
    { label: "Agent: connect Assign owner to Notify",
      run: (host) => host.callAppTool("connect_steps",
        { from: "Assign owner", to: "Notify" }) },
    { label: "Agent: add an escalation step",
      run: (host) => host.callAppTool("add_step",
        { name: "Escalate", kind: "action" }) },
    { label: "Agent: connect to a step that is not there",
      run: async (host, demo) => {
        const result = await host.callAppTool("connect_steps",
          { from: "Classify", to: "Archive" });
        demo.note("log", { level: "warning", data: result.content[0].text }); } },
    { label: "Agent: highlight Classify",
      run: (host) => host.callAppTool("highlight_step", { name: "Classify" }) },
  ],
};
