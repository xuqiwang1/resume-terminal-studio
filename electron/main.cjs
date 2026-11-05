const { app, BrowserWindow, shell, ipcMain } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { pathToFileURL } = require("node:url");
const { configureBridgeRuntime } = require("./bridgeRuntime.cjs");

const isDev = !app.isPackaged;
let mainWindow = null;
let bridgeRuntime = null;
let bridgeModule = null;
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

  // A pre-marker workspace belongs to a user upgrading from an older build. This
  // used to *move* their resume into history, so the app opened on a blank
  // template and their content looked lost. Snapshot it instead and leave the
  // active resume where it is.
  if (!isDev && fs.existsSync(resume) && !fs.existsSync(workspaceMarker)) {
    try {
      const historyDir = path.join(ws, "history");
      fs.mkdirSync(historyDir, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      fs.copyFileSync(resume, path.join(historyDir, `${stamp}-legacy-active-resume.json`));
    } catch (error) {
      console.error("Failed to snapshot the legacy resume:", error);
    }
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
    bridgeModule = await import(pathToFileURL(bridgeRuntime.bridgeServerPath).href);
    const started = await bridgeModule.startBridgeServer(bridgeRuntime.port);
    activeSession = started.runtime.activeSession;
  } catch (err) {
    console.error("Failed to start bridge server inside main process:", err);
    throw err;
  }
}

// A window that silently never appears is the worst possible failure here: the
// user double-clicks the app and nothing happens. Show the reason instead.
function reportFatalStartupError(error) {
  console.error("Resume Studio failed to start:", error);
  const { dialog } = require("electron");
  const detail = String(error?.stack || error?.message || error);
  try {
    dialog.showErrorBox(
      "Resume Studio 无法启动",
      `本地服务启动失败，简历未被修改。\n\n${detail}`
    );
  } catch {
    // Dialogs are unavailable before ready; the console message stands.
  }
  app.exit(1);
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

// PDF export from UI — opens a save dialog, then prints the current page.
ipcMain.handle("export-pdf", async (event) => {
  // Only our own window may drive this. An unvalidated handler lets any frame
  // the renderer ever loads write a file to a path of the user's Downloads.
  if (!mainWindow || event.sender !== mainWindow.webContents) {
    throw new Error("Export is only available from the Resume Studio window");
  }

  try {
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
      margins: { top: 0, bottom: 0, left: 0, right: 0 }
    });
    fs.writeFileSync(filePath, pdf);
    return filePath;
  } catch (error) {
    // Surfaced to the renderer as a rejected invoke rather than an unhandled
    // rejection in the main process.
    console.error("PDF export failed:", error);
    throw new Error(`导出 PDF 失败：${error.message}`);
  }
});

app
  .whenReady()
  .then(async () => {
    await startBridge();
    createWindow();

    app.on("activate", async () => {
      if (BrowserWindow.getAllWindows().length > 0) return;
      try {
        await startBridge();
        createWindow();
      } catch (error) {
        reportFatalStartupError(error);
      }
    });
  })
  .catch(reportFatalStartupError);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Release the listening port, the file watchers, and the open SSE sockets so a
// relaunch does not find the port taken by a process that is going away.
let shuttingDown = false;
app.on("before-quit", (event) => {
  if (shuttingDown || !bridgeModule?.stopBridgeServer) return;
  shuttingDown = true;
  event.preventDefault();
  Promise.resolve()
    .then(() => bridgeModule.stopBridgeServer())
    .catch((error) => console.error("Bridge shutdown failed:", error))
    .finally(() => app.quit());
});
