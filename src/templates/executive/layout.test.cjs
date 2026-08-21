// Verifies the Executive template features bilingual headers, 3-column skills grid,
// project entry without dates, and dynamic section ordering.
const fs = require("node:fs");
const path = require("node:path");
const { rendersThroughRichText } = require("../richTextContract.cjs");

const registry = fs.readFileSync(path.join(__dirname, "..", "registry.js"), "utf8");
const exec = fs.readFileSync(path.join(__dirname, "index.jsx"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "..", "..", "index.css"), "utf8");

let failures = 0;
function check(name, condition) {
  if (condition) console.log(`  ok  - ${name}`);
  else {
    console.error(`  FAIL - ${name}`);
    failures += 1;
  }
}

function wired(fid) {
  return rendersThroughRichText(exec, { fieldId: fid });
}

check("executive template is registered", registry.includes('id: "executive"'));
check("executive template uses exec-page container", exec.includes('className="exec-page"'));
check("executive header has centered title and contact", exec.includes("exec-intent") && exec.includes("exec-contact"));
check("executive header has draggable avatar", exec.includes("position={avatarPos}") && exec.includes("onPositionChange={onAvatarPosChange}"));
check("executive contact renders through RichText", wired('fieldId("header", null, "contact")'));
check("executive title renders through RichText", wired('fieldId("header", null, "title")'));
check("executive project name renders through RichText", wired('fieldId("projects", index, "name")'));
check("executive project role renders through RichText", wired('fieldId("projects", index, "role")'));
check("executive project entries omit right-side date", !exec.includes('fieldId("projects", index, "date")'));
check("executive template renders clean Chinese section titles", exec.includes('renderSectionHead("实习经历")') && !exec.includes("EXECUTIVE SUMMARY"));
check("executive template supports modular section head styles", exec.includes("head-style-"));
check("executive template supports dynamic section ordering", exec.includes("resolveSectionOrder"));
check("executive css defines deep navy accent", css.includes(".template-executive") && css.includes("--exec-accent: #1e3a8a;"));
check("executive css defines skills grid", css.includes(".template-executive .exec-skills-grid") && css.includes(".template-executive .exec-skill-card"));
check("executive css defines 2-column project header", css.includes(".template-executive .exec-project-head") && css.includes("grid-template-columns: max-content 1fr;"));

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll Executive layout checks passed.");
