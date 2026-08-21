// Verifies the Modern template features cobalt accent headers, structured lead-in
// bolding, and clean typography hierarchy.
const fs = require("node:fs");
const path = require("node:path");
const { rendersThroughRichText } = require("../richTextContract.cjs");

const registry = fs.readFileSync(path.join(__dirname, "..", "registry.js"), "utf8");
const modern = fs.readFileSync(path.join(__dirname, "index.jsx"), "utf8");
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
  return rendersThroughRichText(modern, { fieldId: fid });
}

check("modern template is registered", registry.includes('id: "modern"'));
check("modern template uses modern-page container", modern.includes('className="modern-page"'));
check("modern header has centered title and contact", modern.includes("modern-intent") && modern.includes("modern-contact"));
check("modern avatar uses draggable positioning", modern.includes("position={avatarPos}") && modern.includes("onPositionChange={onAvatarPosChange}"));
check("modern contact renders through RichText", wired('fieldId("header", null, "contact")'));
check("modern title renders through RichText", wired('fieldId("header", null, "title")'));
check("modern project name renders through RichText", wired('fieldId("projects", index, "name")'));
check("modern project role renders through RichText", wired('fieldId("projects", index, "role")'));
check("modern skill category renders through RichText", wired('fieldId("skills", index, "category")'));
check("modern structured text supports lead-in bolding", modern.includes("modern-lead-in") && modern.includes("bulletLabeled"));
check("modern css defines accent color variable", css.includes(".template-modern") && css.includes("--modern-accent: #175cd3;"));
check("modern css styles section heads with accent rule", css.includes(".template-modern .modern-section-head h2") && css.includes(".template-modern .modern-rule"));
check("modern css defines summary box styling", css.includes(".template-modern .modern-summary-box"));
check("modern template supports dynamic section ordering", modern.includes("resolveSectionOrder"));

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll Modern layout checks passed.");
