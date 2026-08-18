export const demo = {
  title: "Focus and scroll",
  subtitle: "everything the platform gives you, and the two things it does not",
  maxHeight: 420,
  files: ["index.html"],
  host: {
    hostCapabilities: { logging: {} },
    hostContext: {
      theme: "light", locale: "en-US", timeZone: "UTC",
      containerDimensions: { maxHeight: 400 },
    },
  },
  controls: [
    {
      label: "Host tries to focus the view",
      run: (host, demo) => {
        // There is no message for this. A host can focus the iframe element,
        // which is not the same as focusing anything inside it.
        demo.frame.focus();
        demo.note("log", { level: "info",
          data: "Host focused the frame element. The view did not hear about it." });
      },
    },
  ],
};
