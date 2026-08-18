export const demo = {
  title: "Lifecycle and connectivity",
  subtitle: "ui/resource-teardown is the only pause the protocol gives you",
  maxHeight: 480,
  files: ["index.html"],
  host: {
    hostCapabilities: { logging: {} },
    hostContext: {
      theme: "light", locale: "en-US", timeZone: "UTC",
      containerDimensions: { maxHeight: 460 },
    },
  },
  controls: [
    {
      label: "Tear it down (waits for the answer)",
      run: async (host, demo) => {
        const started = performance.now();
        await host.teardown("The user switched conversations");
        const waited = Math.round(performance.now() - started);
        demo.note("log", { level: "info",
          data: `The view took ${waited}ms to answer. A host that did not wait `
              + "would have thrown the notes away." });
        demo.frame.style.opacity = "0.35";
      },
    },
    {
      label: "Hide the frame",
      run: (host, demo) => {
        // Hiding with CSS does not fire visibilitychange inside the frame.
        // The view keeps polling, which is the gap this control exists to show.
        demo.frame.style.visibility = "hidden";
        demo.note("log", { level: "warning",
          data: "Frame hidden with CSS. No visibilitychange fired inside it." });
      },
    },
    {
      label: "Show the frame",
      run: (host, demo) => { demo.frame.style.visibility = "visible"; },
    },
  ],
};
