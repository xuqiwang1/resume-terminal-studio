const { app, BrowserWindow } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { pathToFileURL } = require("node:url");
const { execFileSync } = require("node:child_process");
const { configureBridgeRuntime } = require("./bridgeRuntime.cjs");

const outputPath = process.argv[2] || "/private/tmp/resume-studio-verified-export.pdf";
const workspacePath =
  process.env.WORKSPACE_DIR ||
  path.join(app.getPath("documents"), "ResumeStudio");

async function run() {
  const runtime = await configureBridgeRuntime({
    isDev: true,
    workspacePath,
    resourcesPath: path.join(__dirname, ".."),
    preferredPort: Number(process.env.RESUME_VERIFY_PORT || 4418)
  });

  const { startBridgeServer } = await import(
    pathToFileURL(runtime.bridgeServerPath).href
  );
  await startBridgeServer(runtime.port);

  const window = new BrowserWindow({
    show: false,
    width: 1400,
    height: 1800,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      additionalArguments: [
        `--resume-bridge-url=${runtime.bridgeBaseUrl}`,
        `--resume-bridge-token=${runtime.bridgeToken}`,
        "--resume-session-id=verify-pdf-export"
      ],
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const indexPath = path.join(__dirname, "..", "dist", "index.html");
  await window.loadURL(pathToFileURL(indexPath).toString());

  await window.webContents.executeJavaScript(`
    new Promise((resolve, reject) => {
      const started = Date.now();
      const tick = () => {
        const text = document.body.innerText || "";
        if (text.includes("AI 办公软件") && text.includes("AI 简历编辑器")) {
          resolve(true);
          return;
        }
        if (Date.now() - started > 10000) {
          reject(new Error("active resume content was not loaded"));
          return;
        }
        setTimeout(tick, 50);
      };
      tick();
    })
  `);

  const fieldStyleProbe = await window.webContents.executeJavaScript(`
    new Promise((resolve, reject) => {
      const run = async () => {
        const dateEl = [...document.querySelectorAll(".resume-field")]
          .find((el) => el.textContent.includes("2025.9-2028.6"));
        if (!dateEl) {
          reject(new Error("education date field was not found"));
          return;
        }
        dateEl.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
        const colorButton = [...document.querySelectorAll(".lsp-chip")]
          .find((el) => el.textContent.trim() === "柔灰");
        if (!colorButton) {
          reject(new Error("field color control was not found"));
          return;
        }
        colorButton.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
        resolve({
          text: dateEl.textContent.trim(),
          color: getComputedStyle(dateEl).color
        });
      };
      run();
    })
  `);

  const metrics = await window.webContents.executeJavaScript(`
    new Promise((resolve, reject) => {
      const started = Date.now();
      const tick = async () => {
        if (window.resumeStudioDebug?.fitAndMeasure) {
          try {
            resolve(await window.resumeStudioDebug.fitAndMeasure());
          } catch (error) {
            reject(error);
          }
          return;
        }
        if (Date.now() - started > 10000) {
          reject(new Error("resumeStudioDebug was not initialized"));
          return;
        }
        setTimeout(tick, 50);
      };
      tick();
    })
  `);

  const pdf = await window.webContents.printToPDF({
    pageSize: "A4",
    preferCSSPageSize: true,
    printBackground: true,
    margins: { top: 0, bottom: 0, left: 0, right: 0 }
  });

  fs.writeFileSync(outputPath, pdf);
  const info = execFileSync("pdfinfo", [outputPath], { encoding: "utf8" });
  const pageMatch = info.match(/^Pages:\s+(\d+)/m);
  const pages = pageMatch ? Number(pageMatch[1]) : NaN;

  console.log(JSON.stringify({ outputPath, pages, metrics, fieldStyleProbe }, null, 2));
  if (pages !== 1) {
    throw new Error(`Expected 1 page, got ${pages}`);
  }
  if (fieldStyleProbe.color !== "rgb(107, 114, 128)") {
    throw new Error(`Expected field color rgb(107, 114, 128), got ${fieldStyleProbe.color}`);
  }

  await window.destroy();
}

app.whenReady()
  .then(run)
  .then(() => app.quit())
  .catch((error) => {
    console.error(error.stack || error.message);
    app.exit(1);
  });
