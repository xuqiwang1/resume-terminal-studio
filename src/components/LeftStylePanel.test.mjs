import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

let failures = 0;
function check(name, cond) {
  if (cond) console.log(`  ok  - ${name}`);
  else {
    console.error(`  FAIL - ${name}`);
    failures += 1;
  }
}

const source = fs.readFileSync(new URL("./LeftStylePanel.jsx", import.meta.url), "utf8");
const registry = fs.readFileSync(new URL("../templates/registry.js", import.meta.url), "utf8");
const here = path.dirname(fileURLToPath(import.meta.url));
const css = fs.readFileSync(path.join(here, "..", "index.css"), "utf8");

check("template picker uses short template names", source.includes("t.shortName || t.name"));
check("template registry defines professional short name", registry.includes('shortName: "求职极简"'));
check("template registry defines editorial short name", registry.includes('shortName: "苹果极简"'));
check("left panel no longer renders current selection summary", !source.includes("CurrentSelectionSummary"));
check("left panel no longer imports selection summary formatter", !source.includes("formatSelectionSummary"));
check("section inspector keeps project note compact", source.includes("名称 / 角色 / 日期三列"));
check("css removed current selection row", !css.includes(".inspector-current"));
check("css removed large current selection card", !css.includes(".inspector-current-card"));

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll LeftStylePanel checks passed.");
