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

check("projects render a dedicated header row", template.includes("pro-project-head"));
check("project name is a first-class selectable field", template.includes('fieldId("projects", index, "name")'));
check("project role is a first-class selectable field", template.includes('fieldId("projects", index, "role")'));
check("project date is a first-class selectable field", template.includes('fieldId("projects", index, "date")'));
check("project details stay in the structured body", template.includes("pro-project-body"));
check("projects share the three-column alignment model", css.includes(".pro-project-head") && css.includes("grid-template-columns: max-content 1fr max-content"));

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll Professional layout checks passed.");
