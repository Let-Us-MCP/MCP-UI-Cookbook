export const demo = {
  title: "Pickers and dropzones",
  subtitle: "three from the platform, one from the host",
  maxHeight: 420,
  files: ["index.html"],
  host: {
    hostCapabilities: { serverResources: {}, logging: {} },
    hostContext: {
      theme: "light", locale: "de-DE", timeZone: "Europe/Berlin",
      containerDimensions: { maxHeight: 400 },
    },
    resources: {
      "ui://cookbook/regions": { mimeType: "application/json",
        text: '{"regions":["North","South","East","West"]}' },
      "ui://cookbook/notes": { mimeType: "text/plain",
        text: "Resource reads are proxied. The view never holds the connection." },
    },
  },
  controls: [
    { label: "Switch to en-US / Los Angeles",
      run: (host) => host.patchContext({ locale: "en-US",
        timeZone: "America/Los_Angeles" }) },
    { label: "Switch to ja-JP / Tokyo",
      run: (host) => host.patchContext({ locale: "ja-JP",
        timeZone: "Asia/Tokyo" }) },
  ],
};
