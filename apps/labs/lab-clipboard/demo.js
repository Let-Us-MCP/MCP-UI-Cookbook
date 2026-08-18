export const demo = {
  title: "Clipboard, files, links",
  subtitle: "ui/download-file, ui/open-link, and two capabilities the browser refuses",
  maxHeight: 480,
  files: ["index.html"],
  host: {
    hostCapabilities: { openLinks: {}, downloadFile: {}, logging: {} },
    hostContext: {
      theme: "light", locale: "en-US", timeZone: "America/New_York",
      containerDimensions: { maxHeight: 460 },
    },
  },
  controls: [
    {
      label: "Refuse downloads",
      run: (host, demo) => {
        delete host.hostCapabilities.downloadFile;
        demo.reloadFrame();
      },
    },
    {
      label: "Refuse links",
      run: (host, demo) => {
        delete host.hostCapabilities.openLinks;
        demo.reloadFrame();
      },
    },
    {
      label: "Allow both again",
      run: (host, demo) => {
        host.hostCapabilities.downloadFile = {};
        host.hostCapabilities.openLinks = {};
        demo.reloadFrame();
      },
    },
  ],
};
