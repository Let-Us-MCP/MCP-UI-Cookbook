export const demo = {
  title: "The handshake",
  subtitle: "ui/initialize, hostCapabilities, and what happens when one is missing",
  maxHeight: 480,
  files: ["index.html"],

  host: {
    hostInfo: { name: "cookbook-emulator", version: "1.0.0" },
    hostCapabilities: {
      openLinks: {},
      logging: {},
      serverResources: { listChanged: false },
      message: { text: {} },
    },
    hostContext: {
      theme: "light",
      locale: "en-GB",
      timeZone: "Europe/London",
      platform: "web",
      displayMode: "inline",
      containerDimensions: { maxHeight: 440 },
    },
    resources: {
      "ui://cookbook/notes": {
        mimeType: "text/plain",
        text: "Resources read through the host are the server's, not the view's.",
      },
    },
  },

  controls: [
    {
      label: "Take away openLinks",
      run: (host, demo) => {
        delete host.hostCapabilities.openLinks;
        demo.reloadFrame();
      },
    },
    {
      label: "Give back openLinks",
      run: (host, demo) => {
        host.hostCapabilities.openLinks = {};
        demo.reloadFrame();
      },
    },
    {
      label: "Become a very poor host",
      run: (host, demo) => {
        host.hostCapabilities = {};
        demo.reloadFrame();
      },
    },
  ],
};
