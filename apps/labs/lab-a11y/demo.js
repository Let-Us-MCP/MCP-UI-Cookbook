export const demo = {
  title: "Accessibility signals",
  subtitle: "media queries the host never sends, and a live region it never sees",
  maxHeight: 460,
  files: ["index.html"],
  host: {
    hostCapabilities: { logging: {} },
    hostContext: {
      theme: "light", locale: "en-US", timeZone: "UTC",
      containerDimensions: { maxHeight: 440 },
    },
  },
  controls: [
    {
      label: "Claim dark, stay light",
      // The host says dark. The operating system still says light, and the
      // media query still agrees with the operating system. Both are visible
      // in the strip at the top of the view.
      run: (host) => host.patchContext({
        theme: "dark",
        styles: { variables: {
          "--color-background-primary": "#101418",
          "--color-text-primary": "#e8edf2",
          "--color-background-secondary": "#1a2029",
        } },
      }),
    },
    {
      label: "Back to light",
      run: (host) => host.patchContext({ theme: "light",
        styles: { variables: {} } }),
    },
  ],
};
