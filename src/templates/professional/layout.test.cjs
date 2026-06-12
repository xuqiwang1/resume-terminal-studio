// Verifies the Professional template keeps projects aligned with experience:
// name/role/date render in a three-column header instead of being buried in body text.
const fs = require("node:fs");
const path = require("node:path");

const templatePath = path.join(__dirname, "index.jsx");
const cssPath = path.join(__dirname, "../../index.css");
const template = fs.readFileSync(templatePath, "utf8");
const css = fs.readFileSync(cssPath, "utf8");

let failures = 0;
function check(name, cond) {
  if (cond) console.log(`  ok  - ${name}`);
  else {
    console.error(`  FAIL - ${name}`);
    failures += 1;
  }
}

function hasRichText(value, fid) {
  return template.includes(`<RichText value={${value}} fieldId={${fid}}`);
}

check("projects render a dedicated header row", template.includes("pro-project-head"));
check("project name is a first-class selectable field", template.includes('fieldId("projects", index, "name")'));
check("project role is a first-class selectable field", template.includes('fieldId("projects", index, "role")'));
check("project date is a first-class selectable field", template.includes('fieldId("projects", index, "date")'));
check("project details stay in the structured body", template.includes("pro-project-body"));
check("projects share the three-column alignment model", css.includes(".pro-project-head") && css.includes("grid-template-columns: max-content 1fr max-content"));
check("professional header participates in active section state", template.includes('sectionClass(activeSectionId, workingSection, "header")'));
check("professional structured details render through RichText", template.includes("<RichText value={labeled[2]}") && template.includes("<RichText value={trimmed}"));
check("professional contact renders through RichText", hasRichText("resume.contact", 'fieldId("header", null, "contact")'));
check("professional title renders through RichText", hasRichText("resume.title", 'fieldId("header", null, "title")'));
check("professional project name renders through RichText", hasRichText("item.name", 'fieldId("projects", index, "name")'));
check("professional project role renders through RichText", hasRichText("item.role", 'fieldId("projects", index, "role")'));
check("professional skill category renders through RichText", hasRichText("item.category", 'fieldId("skills", index, "category")'));
check("education school column defaults centered", template.includes('const schoolAlign = eduLayout.schoolAlign || "center"'));
check("education rows center school in total row space", css.includes("grid-template-columns: minmax(0, 1fr) max-content minmax(0, 1fr);"));
check("centered education school field stays on row center", css.includes(".edu-school-center .pro-edu-school { justify-self: center; }"));
check("education date uses body text styling", css.includes(".pro-edu-date") && css.includes("font-size: var(--r-fs-body, 12px);"));
check("education date inline style uses body size", template.includes('fieldId("education", index, "date"), { fontSize: "var(--r-fs-body, 12px)" }'));
check("education date inline style does not use muted size", !template.includes('fieldId("education", index, "date"), { fontSize: "var(--r-fs-muted'));
check("education school uses body text styling", css.includes(".pro-edu-school strong") && css.includes("color: var(--r-body, #333);"));
check("education major uses body text styling", css.includes(".pro-edu-major") && css.includes("font-size: var(--r-fs-body, 12px);"));
check("education tag is inline body text, not a badge", css.includes(".pro-edu-tag") && css.includes("border: none;"));

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll Professional layout checks passed.");
