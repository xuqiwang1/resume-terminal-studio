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

const source = fs.readFileSync(new URL("./PendingPatchBanner.jsx", import.meta.url), "utf8");
const here = path.dirname(fileURLToPath(import.meta.url));
const css = fs.readFileSync(
  path.join(here, "..", "index.css"),
  "utf8"
);

check("banner handles batch patch kind", source.includes('pending.kind === "batch"'));
check("batch view renders task title", source.includes("pending.title"));
check("batch view groups changes", source.includes("groupedChanges"));
check("batch view renders append label", source.includes("append_item"));
check("batch view renders replace label", source.includes("replace_item"));
check("scalar replace_field label omits fake item index", source.includes("change.index == null") && source.includes("修改${sectionLabel}"));
check("css defines batch group layout", css.includes(".pending-batch-group"));
check("css defines batch change rows", css.includes(".pending-batch-change"));

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll PendingPatchBanner checks passed.");
