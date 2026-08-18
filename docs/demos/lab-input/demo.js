export const demo = {
  title: "Keyboard, pointer, selection",
  subtitle: "eight capabilities, zero messages",
  maxHeight: 480,
  files: ["index.html"],
  host: {
    hostCapabilities: { logging: {} },
    hostContext: {
      theme: "light", locale: "en-US", timeZone: "UTC",
      deviceCapabilities: { hover: true, touch: false },
      containerDimensions: { maxHeight: 460 },
    },
  },
  controls: [
    {
      label: "Switch to a touch device",
      run: (host) => host.patchContext({
        deviceCapabilities: { touch: true, hover: false } }),
    },
    {
      label: "Switch back to a pointer",
      run: (host) => host.patchContext({
        deviceCapabilities: { touch: false, hover: true } }),
    },
  ],
};
