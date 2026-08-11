// The Editorial visual check needs a display and a built dist/, so it cannot run inside
// `npm test`. This guards against the wiring rotting silently: the script, its fixture,
// and the npm entry point must all still exist, and the assertions it makes must still
// reference the real selectors.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(here, "..");

const scriptPath = path.join(repoRoot, "electron", "verify-editorial-visual.cjs");
const fixturePath = path.join(repoRoot, "demo", "fixtures", "editorial-visual-resume.json");

assert.ok(fs.existsSync(scriptPath), "electron/verify-editorial-visual.cjs is missing");
assert.ok(fs.existsSync(fixturePath), "the Editorial visual fixture is missing");

const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));
assert.ok(pkg.scripts["verify:visual"], "npm run verify:visual is not registered");
assert.ok(
  pkg.scripts["verify:visual"].includes("verify-editorial-visual.cjs"),
  "verify:visual must point at the Editorial visual check"
);
assert.ok(
  !pkg.scripts.test.includes("verify-editorial-visual"),
  "the visual check must stay out of `npm test`: it needs a display and a built dist/"
);

const source = fs.readFileSync(scriptPath, "utf8");

// The fixture must be a valid resume that pins the template, or the check silently
// verifies whatever template happened to be active.
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
assert.equal(fixture.styleSettings.templateId, "editorial");
for (const key of ["name", "title", "contact", "summary", "education", "experience", "projects", "skills"]) {
  assert.ok(fixture[key], `fixture is missing ${key}`);
}

// It must run against an isolated workspace — never the user's real resume.
assert.ok(source.includes("mkdtempSync"), "the check must build a throwaway workspace");
assert.ok(!source.includes('path.join(app.getPath("documents")'), "the check must not read the user workspace");

// The geometry assertions that give the check its value.
assert.ok(source.includes("auto-fitting") && source.includes("did not settle"),
  "must wait for auto-fit to settle before measuring or capturing");
assert.ok(source.includes("document.fonts"), "must wait for fonts before measuring");
assert.ok(source.includes("page-overflow-warning"), "must fail if the app shows an overflow warning");
assert.ok(source.includes("collapsed to zero height"), "must catch sections that render empty");
assert.ok(source.includes("passes printable bottom"), "must catch sections crossing the page bottom");
assert.ok(source.includes("section order"), "must pin the template's section order");
assert.ok(source.includes("textContent"), "must read textContent: innerText is empty in an offscreen window");
assert.ok(source.includes("toPNG"), "must write a screenshot artifact for human review");

console.log("All Editorial visual check wiring assertions passed.");
