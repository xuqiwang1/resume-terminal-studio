const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const projectRoot = path.resolve(__dirname, "../..");
const width = 1440;
const height = 900;
const fps = 20;
const durationSeconds = 16;
const totalFrames = fps * durationSeconds;
const stagePath = path.join(projectRoot, "demo/stage/recording-stage.html");
const outputPath = process.argv[2]
  ? path.resolve(projectRoot, process.argv[2])
  : path.join(projectRoot, "site/assets/demo-patch-flow.mp4");
const posterPath = outputPath.replace(/\.mp4$/i, "-poster.png");
const frameRoot = fs.mkdtempSync(path.join(os.tmpdir(), "resume-studio-stage-"));

app.commandLine.appendSwitch("disable-background-timer-throttling");
app.commandLine.appendSwitch("disable-renderer-backgrounding");

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${result.status}`);
  }
}

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const win = new BrowserWindow({
    width,
    height,
    show: false,
    frame: false,
    resizable: false,
    transparent: false,
    backgroundColor: "#f7f5ee",
    webPreferences: {
      backgroundThrottling: false,
      contextIsolation: true,
      offscreen: true,
      nodeIntegration: false,
    },
  });

  await win.loadFile(stagePath);
  await win.webContents.executeJavaScript(
    "document.fonts ? document.fonts.ready.then(() => true) : true"
  );
  await win.webContents.executeJavaScript("window.renderFrame(0)");
  await wait(120);

  for (let index = 0; index < totalFrames; index += 1) {
    const progress = index / (totalFrames - 1);
    await win.webContents.executeJavaScript(`window.renderFrame(${progress})`);
    await wait(6);
    const image = await win.capturePage({ x: 0, y: 0, width, height });
    const framePath = path.join(frameRoot, `frame_${String(index).padStart(4, "0")}.png`);
    fs.writeFileSync(framePath, image.toPNG());
    if (index % fps === 0) {
      console.log(`captured ${index}/${totalFrames}`);
    }
  }

  run("ffmpeg", [
    "-y",
    "-framerate",
    String(fps),
    "-i",
    path.join(frameRoot, "frame_%04d.png"),
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-profile:v",
    "high",
    "-crf",
    "18",
    "-movflags",
    "+faststart",
    outputPath,
  ]);

  run("ffmpeg", [
    "-y",
    "-ss",
    "00:00:07.2",
    "-i",
    outputPath,
    "-update",
    "1",
    "-frames:v",
    "1",
    posterPath,
  ]);

  fs.rmSync(frameRoot, { recursive: true, force: true });
  console.log(`wrote ${outputPath}`);
  console.log(`wrote ${posterPath}`);
}

app.whenReady()
  .then(main)
  .then(() => app.quit())
  .catch((error) => {
    console.error(error);
    try {
      fs.rmSync(frameRoot, { recursive: true, force: true });
    } catch {
      // Ignore cleanup failures.
    }
    app.exit(1);
  });
