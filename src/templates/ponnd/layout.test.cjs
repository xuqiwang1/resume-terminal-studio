// Verifies the Ponnd Swiss Editorial template features left-aligned header with meta bar,
// modular section head styles, RichText wiring, and dynamic section ordering.
const fs = require("node:fs");
const path = require("node:path");
const { rendersThroughRichText } = require("../richTextContract.cjs");

const registry = fs.readFileSync(path.join(__dirname, "..", "registry.js"), "utf8");
const ponnd = fs.readFileSync(path.join(__dirname, "index.jsx"), "utf8");
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
  return rendersThroughRichText(ponnd, { fieldId: fid });
}

check("ponnd template is registered", registry.includes('id: "ponnd"') && registry.includes('shortName: "瑞士极简"'));
check("ponnd template uses ponnd-page container", ponnd.includes('className="ponnd-page"'));
check("ponnd header has meta bar with title and contact", ponnd.includes("ponnd-header-meta") && ponnd.includes("ponnd-intent") && ponnd.includes("ponnd-contact"));
check("ponnd header has draggable avatar", ponnd.includes("position={avatarPos}") && ponnd.includes("onPositionChange={onAvatarPosChange}"));
check("ponnd contact renders through RichText", wired('fieldId("header", null, "contact")'));
check("ponnd title renders through RichText", wired('fieldId("header", null, "title")'));
check("ponnd project name renders through RichText", wired('fieldId("projects", index, "name")'));
check("ponnd project role renders through RichText", wired('fieldId("projects", index, "role")'));
check("ponnd skill category renders through RichText", wired('fieldId("skills", index, "category")'));
check("ponnd template supports modular section head styles", ponnd.includes("head-style-"));
check("ponnd template supports dynamic section ordering", ponnd.includes("resolveSectionOrder"));
check("ponnd css defines Swiss ink variable", css.includes(".template-ponnd") && css.includes("--ponnd-ink: #141413;"));

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll Ponnd layout checks passed.");
