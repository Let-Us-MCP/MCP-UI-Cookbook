const fixtures = await fetch(new URL("fixtures.json", import.meta.url))
  .then((r) => r.json());

let revision = 1;

export const demo = {
  title: "Recipe 4: Document Editor",
  subtitle: "undo, autosave through a tool, teardown, and an agent that proposes",
  tool: "load_document",
  maxHeight: 560,
  files: ["index.html", "server.js", "../lib/mcp-server.js",
          "fixtures.json"],
  host: {
    hostCapabilities: { serverTools: {}, sampling: {}, logging: {},
                        message: { text: {} } },
    hostContext: {
      theme: "light", locale: "en-US", timeZone: "UTC",
      containerDimensions: { maxHeight: 540 },
    },
    resources: {
      "ui://cookbook/document-editor":
        { href: new URL("index.html", import.meta.url).href,
          _meta: { ui: { csp: {}, prefersBorder: true } } },
    },
    serverTools: {
      load_document: {
        descriptor: { name: "load_document", description: "Load the draft",
          inputSchema: { type: "object" },
          _meta: { ui: { resourceUri: "ui://cookbook/document-editor" } } },
        result: () => fixtures.results.load_document,
      },
      save_document: {
        descriptor: { name: "save_document", description: "Persist the draft",
          inputSchema: { type: "object" },
          _meta: { ui: { visibility: ["app"] } } },
        delayMs: 300,
        result: () => ({ content: [{ type: "text",
          text: `Saved revision ${++revision} at the server.` }] }),
      },
    },
  },
  controls: [
    { label: "Agent proposes a rewrite",
      run: (host) => host.callAppTool("propose_rewrite", {
        html: "<p>The renewal has slipped to the <strong>21st</strong>. The "
            + "vendor patch is delayed and Priya is chasing a firm date.</p>",
        rationale: "The vendor confirmed the delay in the ticket this morning." }) },
    { label: "Agent highlights a phrase",
      run: (host) => host.callAppTool("highlight_phrase", { text: "on track" }) },
    { label: "Agent reads the document",
      run: async (host, demo) => {
        const result = await host.callAppTool("get_document", {});
        demo.note("log", { level: "info", data: result.content[0].text }); } },
    { label: "Close the view (waits for the save)",
      run: async (host, demo) => {
        await host.teardown("The user closed the tab");
        demo.frame.style.opacity = "0.35"; } },
  ],
};
