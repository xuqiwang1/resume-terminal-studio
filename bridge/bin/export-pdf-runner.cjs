const { app, BrowserWindow } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const fs = require("node:fs");

const [, , htmlPath, outputPath] = process.argv;

async function run() {
  if (!htmlPath || !outputPath) {
    throw new Error("Usage: export-pdf-runner <htmlPath> <outputPath>");
  }

  const window = new BrowserWindow({
    show: false,
    width: 1280,
    height: 1810,
    webPreferences: {
      sandbox: true
    }
  });

  await window.loadURL(pathToFileURL(path.resolve(htmlPath)).toString());
  const pdf = await window.webContents.printToPDF({
    printBackground: true,
    preferCSSPageSize: true,
    margins: {
      top: 0,
      bottom: 0,
      left: 0,
      right: 0
    }
  });
  fs.writeFileSync(path.resolve(outputPath), pdf);
  await window.destroy();
}

app.whenReady()
  .then(run)
  .then(() => app.quit())
  .catch((error) => {
    console.error(error.message);
    app.exit(1);
  });
