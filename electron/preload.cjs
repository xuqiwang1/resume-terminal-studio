const { contextBridge, ipcRenderer } = require("electron");

function readArg(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : "";
}

contextBridge.exposeInMainWorld("desktopApp", {
  isDesktop: true,
  bridgeBaseUrl: readArg("resume-bridge-url") || process.env.RESUME_BRIDGE_URL || "",
  bridgeToken: readArg("resume-bridge-token") || process.env.RESUME_BRIDGE_TOKEN || "",
  sessionId: readArg("resume-session-id") || "",
  runtimeReady: true,
  exportPdf: () => ipcRenderer.invoke("export-pdf")
});
