const { app, BrowserWindow, shell, ipcMain } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { pathToFileURL } = require("node:url");
const { configureBridgeRuntime } = require("./bridgeRuntime.cjs");

const isDev = !app.isPackaged;
let mainWindow = null;
let bridgeRuntime = null;
let activeSession = null;

function getWorkspacePath() {
  if (process.env.WORKSPACE_DIR) return path.resolve(process.env.WORKSPACE_DIR);
  if (isDev) return path.join(__dirname, "..", "workspace");
  return path.join(app.getPath("documents"), "ResumeStudio");
}

function copyBundledTemplate(targetPath) {
  const src = isDev
    ? path.join(__dirname, "..", "workspace-template", "active-resume.json")
    : path.join(process.resourcesPath, "workspace", "active-resume.json");
  if (src && fs.existsSync(src)) {
    fs.copyFileSync(src, targetPath);
    return true;
  }
  return false;
}

function ensureWorkspace() {
  const ws = getWorkspacePath();
  if (!fs.existsSync(ws)) fs.mkdirSync(ws, { recursive: true });

  // Record Electron path for CLI PDF engine
  fs.writeFileSync(path.join(ws, ".electron-path"), process.execPath, "utf8");

  const resume = path.join(ws, "active-resume.json");
  const workspaceMarker = path.join(ws, ".resume-studio-workspace.json");

  if (!isDev && fs.existsSync(resume) && !fs.existsSync(workspaceMarker)) {
    const historyDir = path.join(ws, "history");
    fs.mkdirSync(historyDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    fs.renameSync(resume, path.join(historyDir, `${stamp}-legacy-active-resume.json`));
  }

  if (!fs.existsSync(resume)) {
    if (!copyBundledTemplate(resume)) {
      const fallback = {
        name: "Your Name",
        title: "Target Role | Availability | Internship Duration",
        contact: "Phone | Email | Location",
        summary: "",
        experience: [],
        projects: [],
        avatar: null,
        education: [],
        skills: []
      };
      fs.writeFileSync(resume, JSON.stringify(fallback, null, 2), "utf8");
    }
  }

  if (!fs.existsSync(workspaceMarker)) {
    fs.writeFileSync(
      workspaceMarker,
      JSON.stringify({ version: 1, createdAt: new Date().toISOString() }, null, 2),
      "utf8"
    );
  }
}

async function startBridge() {
  ensureWorkspace();
  if (!bridgeRuntime) {
    bridgeRuntime = await configureBridgeRuntime({
      isDev,
      workspacePath: getWorkspacePath(),
      resourcesPath: process.resourcesPath
    });
  }
  try {
    const { startBridgeServer } = await import(pathToFileURL(bridgeRuntime.bridgeServerPath).href);
    const started = await startBridgeServer(bridgeRuntime.port);
    activeSession = started.runtime.activeSession;
  } catch (err) {
    console.error("Failed to start bridge server inside main process:", err);
    throw err;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 900,
    minHeight: 640,
    title: "Resume Studio",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 18 },
    backgroundColor: "#f5f5f7",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      additionalArguments: [
        `--resume-bridge-url=${bridgeRuntime?.bridgeBaseUrl || ""}`,
        `--resume-bridge-token=${bridgeRuntime?.bridgeToken || ""}`,
        `--resume-session-id=${activeSession?.sessionId || ""}`
      ],
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isDev) {
    mainWindow.loadURL("http://127.0.0.1:4173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (["https:", "http:", "mailto:"].includes(parsed.protocol)) {
        shell.openExternal(url);
      }
    } catch {
      // Ignore malformed external URLs.
    }
    return { action: "deny" };
  });
}

// PDF export from UI — opens a save dialog, then prints PrintView via a hidden window
ipcMain.handle("export-pdf", async () => {
  if (!mainWindow) throw new Error("No window");

  const { dialog } = require("electron");
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: "导出 PDF",
    defaultPath: path.join(app.getPath("downloads"), `resume-${Date.now()}.pdf`),
    filters: [{ name: "PDF", extensions: ["pdf"] }]
  });
  if (canceled || !filePath) return null;

  const pdf = await mainWindow.webContents.printToPDF({
    pageSize: "A4",
    preferCSSPageSize: true,
    printBackground: true,
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
  });
  fs.writeFileSync(filePath, pdf);
  return filePath;
});

app.whenReady().then(async () => {
  await startBridge();
  createWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await startBridge();
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  // cleanup if needed
});
