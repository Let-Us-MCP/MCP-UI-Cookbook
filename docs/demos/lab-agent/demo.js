export const demo = {
  title: "UI to agent",
  subtitle: "ui/message, ui/update-model-context, sampling/createMessage",
  maxHeight: 480,
  files: ["index.html"],
  host: {
    hostCapabilities: {
      message: { text: {} },
      updateModelContext: { text: {}, structuredContent: {} },
      sampling: {},
      logging: {},
    },
    hostContext: {
      theme: "light", locale: "en-US", timeZone: "UTC",
      containerDimensions: { maxHeight: 460 },
    },
    sample: async (params) =>
      "INC-4133 has been stalled for 31 days awaiting a vendor patch. "
      + "Priya is chasing the vendor and expects an answer this week.",
  },
  controls: [
    {
      label: "Show what the model would see",
      run: (host, demo) => {
        const context = host.modelContext;
        demo.note("log", { level: "info", data: context
          ? JSON.stringify(context.structuredContent ?? context)
          : "The view has published no context yet." });
      },
    },
    {
      label: "Withdraw sampling",
      run: (host, demo) => {
        delete host.hostCapabilities.sampling;
        demo.reloadFrame();
      },
    },
    {
      label: "Withdraw context updates",
      run: (host, demo) => {
        delete host.hostCapabilities.updateModelContext;
        demo.reloadFrame();
      },
    },
  ],
};
