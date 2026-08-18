// Host fixture for the surfaces lab.
//
// The host half of a demo is a configuration, not a program: which
// capabilities it admits to, what context it hands over, and which buttons
// the page offers for things only a host can do.

export const demo = {
  title: "Surfaces and geometry",
  subtitle: "size-changed, containerDimensions, display modes, teardown",
  maxHeight: 460,
  files: ["index.html"],

  host: {
    hostInfo: { name: "cookbook-emulator", version: "1.0.0" },
    hostCapabilities: {
      openLinks: {},
      logging: {},
    },
    hostContext: {
      theme: "light",
      displayMode: "inline",
      availableDisplayModes: ["inline", "fullscreen"],
      containerDimensions: { maxHeight: 420 },
      locale: "en-US",
      timeZone: "UTC",
      platform: "web",
    },
  },

  controls: [
    {
      label: "Fix the height at 200px",
      run: (host) => host.patchContext({
        containerDimensions: { height: 200 },
      }),
    },
    {
      label: "Make the height flexible",
      run: (host) => host.patchContext({
        containerDimensions: { maxHeight: 420 },
      }),
    },
    {
      label: "Withdraw fullscreen",
      run: (host) => host.patchContext({ availableDisplayModes: ["inline"] }),
    },
    {
      label: "Tear the view down",
      run: async (host, demo) => {
        await host.teardown("The user closed the conversation");
        demo.frame.style.opacity = "0.35";
      },
    },
  ],
};
