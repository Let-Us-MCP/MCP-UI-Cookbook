const DARK = {
  "--color-background-primary": "#101418",
  "--color-background-secondary": "#171d23",
  "--color-text-primary": "#e8edf2",
  "--color-text-secondary": "#9aa6b2",
  "--color-text-info": "#7cc4f0",
  "--color-border-primary": "#243039",
};

const BRAND = {
  "--color-background-primary": "#fffdf7",
  "--color-background-secondary": "#f6efe2",
  "--color-text-primary": "#2b2118",
  "--color-text-secondary": "#7a6a58",
  "--color-text-info": "#9a5b1f",
  "--color-border-primary": "#e3d6c0",
  "--border-radius-lg": "2px",
  "--border-radius-md": "2px",
  "--font-sans": "Georgia, 'Times New Roman', serif",
};

export const demo = {
  title: "Host environment and theming",
  subtitle: "hostContext, styles.variables, and changes that arrive later",
  maxHeight: 520,
  files: ["index.html"],
  host: {
    hostCapabilities: { logging: {} },
    hostContext: {
      theme: "light",
      locale: "en-US",
      timeZone: "America/New_York",
      platform: "web",
      userAgent: "cookbook-emulator/1.0",
      displayMode: "inline",
      deviceCapabilities: { hover: true, touch: false },
      containerDimensions: { maxHeight: 500 },
      styles: { variables: {} },
    },
  },
  controls: [
    { label: "Go dark",
      run: (host) => host.patchContext({ theme: "dark",
        styles: { variables: DARK } }) },
    { label: "Go light",
      run: (host) => host.patchContext({ theme: "light",
        styles: { variables: {} } }) },
    { label: "A host with taste",
      run: (host) => host.patchContext({ theme: "light",
        styles: { variables: BRAND } }) },
    { label: "Send only half the variables",
      run: (host) => host.patchContext({ theme: "dark",
        styles: { variables: { "--color-background-primary": "#101418" } } }) },
    { label: "Add a notch",
      run: (host) => host.patchContext({
        safeAreaInsets: { top: 28, right: 12, bottom: 34, left: 12 } }) },
  ],
};
