let mode = "ok";

export const demo = {
  title: "Progress, cancellation and errors",
  subtitle: "notifications/progress, notifications/cancelled, and a failure worth reading",
  maxHeight: 460,
  files: ["index.html"],
  host: {
    hostCapabilities: { serverTools: {}, logging: {} },
    hostContext: {
      theme: "light", locale: "en-US", timeZone: "UTC",
      displayMode: "inline",
      availableDisplayModes: ["inline", "fullscreen"],
      containerDimensions: { maxHeight: 440 },
    },
    serverTools: {
      reindex: {
        descriptor: { name: "reindex", description: "Reindex an archive",
          inputSchema: { type: "object",
            properties: { scope: { type: "string" } } } },
        result: async (args, host) => {
          // The server streams progress against the request that is running.
          for (const step of [1, 2, 3, 4]) {
            await new Promise((r) => setTimeout(r, 320));
            host.notify("notifications/progress", {
              progressToken: 1, progress: step, total: 4,
              message: ["Listing objects.", "Reading metadata.",
                        "Building the index.", "Writing."][step - 1],
            });
          }
          if (mode === "fail") {
            return { isError: true, content: [{ type: "text",
              text: "The index volume is full, so nothing was written. "
                  + "Free space and retry." }] };
          }
          return { content: [{ type: "text",
            text: "Reindexed 41,208 objects in 1.3 seconds." }] };
        },
      },
    },
  },
  controls: [
    { label: "Make the tool fail", run: () => { mode = "fail"; } },
    { label: "Make the tool succeed", run: () => { mode = "ok"; } },
    { label: "Cancel it from the host",
      run: (host) => host.cancelTool("The user stopped the request") },
  ],
};
