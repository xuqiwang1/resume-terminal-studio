// Automated visual check for the Editorial (Apple) template.
//
// The other template tests assert that identifiers exist in the source. This one
// renders the real thing in Electron and asserts the geometry that actually decides
// whether a resume prints correctly: one A4 page, every section inside the printable
// area, nothing collapsed to zero height, and the section order the template promises.
//
// It also writes a PNG so a human can look at the result. The PNG is an artifact,
// not an assertion — pixel diffing across font-rendering environments is noise.
//
// Not part of `npm test`: it needs a display/GPU and a built dist/. Run:
//   npm run build && npm run verify:visual

const { app, BrowserWindow } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { pathToFileURL } = require("node:url");
const { configureBridgeRuntime } = require("./bridgeRuntime.cjs");

const A4_WIDTH = 794;
const A4_HEIGHT = 1123;
const TOLERANCE = 2;

const EXPECTED_SECTIONS = ["header", "education", "skills", "experience", "projects", "summary"];

const outputPath = process.argv[2] || "/private/tmp/resume-studio-editorial.png";
const fixturePath = path.join(__dirname, "..", "demo", "fixtures", "editorial-visual-resume.json");

// An isolated workspace: this check must never read or write the user's real resume.
function createFixtureWorkspace() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "resume-editorial-visual-"));
  fs.mkdirSync(path.join(dir, "history"), { recursive: true });
  fs.mkdirSync(path.join(dir, "materials"), { recursive: true });
  fs.copyFileSync(fixturePath, path.join(dir, "active-resume.json"));
  return dir;
}

const waitFor = (expression, description, timeoutMs = 15000) => `
  new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      let value;
      try {
        value = (${expression});
      } catch (error) {
        reject(error);
        return;
      }
      if (value) {
        resolve(value);
        return;
      }
      if (Date.now() - started > ${timeoutMs}) {
        reject(new Error(${JSON.stringify(description)}));
        return;
      }
      setTimeout(tick, 50);
    };
    tick();
  })
`;

async function run() {
  const workspacePath = createFixtureWorkspace();
  const runtime = await configureBridgeRuntime({
    isDev: true,
    workspacePath,
    resourcesPath: path.join(__dirname, ".."),
    preferredPort: Number(process.env.RESUME_VISUAL_PORT || 4419)
  });

  const { startBridgeServer } = await import(pathToFileURL(runtime.bridgeServerPath).href);
  await startBridgeServer(runtime.port);

  const window = new BrowserWindow({
    show: false,
    width: 1400,
    height: 1400,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      additionalArguments: [
        `--resume-bridge-url=${runtime.bridgeBaseUrl}`,
        `--resume-bridge-token=${runtime.bridgeToken}`,
        "--resume-session-id=verify-editorial-visual"
      ],
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const indexPath = path.join(__dirname, "..", "dist", "index.html");
  if (!fs.existsSync(indexPath)) {
    throw new Error("dist/index.html is missing — run `npm run build` first");
  }
  await window.loadURL(pathToFileURL(indexPath).toString());

  // The fixture pins templateId, so the page should come up in Editorial without any
  // UI interaction. Waiting on the class is what proves the persisted style was applied.
  await window.webContents.executeJavaScript(
    waitFor('document.querySelector(".resume-canvas .template-editorial") && true',
      "Editorial template did not render (persisted styleSettings.templateId was not applied)")
  );

  await window.webContents.executeJavaScript(
    waitFor("window.resumeStudioDebug?.fitAndMeasure && true", "resumeStudioDebug was not initialized")
  );

  // Auto-fit hides the visible page (.auto-fitting -> visibility: hidden) while it
  // searches for a density that fits. Measuring or capturing before it settles yields
  // real geometry but a blank screenshot, and an overflow number that is still moving.
  await window.webContents.executeJavaScript(
    waitFor('document.querySelector(".resume-canvas .resume-page.auto-fitting") === null && true',
      "auto-fit did not settle: the visible page stayed hidden")
  );

  // Let fonts settle before measuring, or heights are read against fallback metrics.
  await window.webContents.executeJavaScript(
    "document.fonts ? document.fonts.ready.then(() => true) : Promise.resolve(true)"
  );

  // Two frames after settling, so the overflow report the app exposes reflects the
  // committed style rather than the previous pass.
  await window.webContents.executeJavaScript(`
    new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))
  `);

  const report = await window.webContents.executeJavaScript(`
    (async () => {
      const metrics = await window.resumeStudioDebug.fitAndMeasure();
      const page = document.querySelector(".resume-canvas .resume-page");
      const rect = page.getBoundingClientRect();
      const pageTop = rect.top;
      const pad = parseFloat(getComputedStyle(page).paddingTop) || 0;
      const sections = [...page.querySelectorAll("[data-section]")].map((el) => {
        const box = el.getBoundingClientRect();
        return {
          sectionId: el.getAttribute("data-section"),
          top: Math.round(box.top - pageTop),
          bottom: Math.round(box.bottom - pageTop),
          height: Math.round(box.height),
          // textContent, not innerText: innerText depends on "rendered" text, which an
          // offscreen BrowserWindow reports as empty even though layout has run.
          text: (el.textContent || "").trim().slice(0, 40)
        };
      });
      return {
        metrics,
        pagePadding: pad,
        // The badge the user actually sees. Read from the DOM so the check cannot pass
        // while the app is telling the user the page overflows.
        overflowBadge: (document.querySelector(".page-overflow-warning")?.textContent || "").trim(),
        page: { width: Math.round(rect.width), height: Math.round(rect.height) },
        sections
      };
    })()
  `);

  const image = await window.capturePage();
  fs.writeFileSync(outputPath, image.toPNG());

  const failures = [];
  const fail = (message) => failures.push(message);

  if (Math.abs(report.page.width - A4_WIDTH) > TOLERANCE) {
    fail(`page width ${report.page.width} != ${A4_WIDTH}`);
  }
  if (Math.abs(report.page.height - A4_HEIGHT) > TOLERANCE) {
    fail(`page height ${report.page.height} != ${A4_HEIGHT}`);
  }
  if (!report.metrics.fitsA4) {
    fail(`content does not fit one A4 page (overflow ${report.metrics.overflow}px)`);
  }
  if (report.metrics.overflowSections?.length) {
    fail(`sections overflow: ${report.metrics.overflowSections.map((s) => `${s.label} +${s.overflowPx}px`).join(", ")}`);
  }
  if (report.overflowBadge) {
    fail(`the app is showing an overflow warning: "${report.overflowBadge}"`);
  }

  const renderedIds = report.sections.map((s) => s.sectionId);
  for (const sectionId of EXPECTED_SECTIONS) {
    if (!renderedIds.includes(sectionId)) fail(`section "${sectionId}" was not rendered`);
  }
  // Order is part of the template's contract: education leads, summary closes.
  const orderedRendered = renderedIds.filter((id) => EXPECTED_SECTIONS.includes(id));
  if (orderedRendered.join(",") !== EXPECTED_SECTIONS.join(",")) {
    fail(`section order ${orderedRendered.join(",")} != ${EXPECTED_SECTIONS.join(",")}`);
  }

  const contentBottom = A4_HEIGHT - report.pagePadding;
  for (const section of report.sections) {
    if (section.height <= 0) fail(`section "${section.sectionId}" collapsed to zero height`);
    if (!section.text) fail(`section "${section.sectionId}" rendered no text`);
    if (section.bottom > contentBottom + TOLERANCE) {
      fail(`section "${section.sectionId}" bottom ${section.bottom} passes printable bottom ${contentBottom}`);
    }
    if (section.top < -TOLERANCE) fail(`section "${section.sectionId}" starts above the page`);
  }

  console.log(JSON.stringify({ screenshot: outputPath, ...report }, null, 2));
  await window.destroy();
  fs.rmSync(workspacePath, { recursive: true, force: true });

  if (failures.length) {
    throw new Error(`Editorial visual check failed:\n  - ${failures.join("\n  - ")}`);
  }
  console.log(`\nEditorial visual check passed. Screenshot: ${outputPath}`);
}

app.whenReady()
  .then(run)
  .then(() => app.quit())
  .catch((error) => {
    console.error(error.stack || error.message);
    app.exit(1);
  });
