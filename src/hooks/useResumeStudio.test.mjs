import fs from "node:fs";

let failures = 0;
function check(name, cond) {
  if (cond) console.log(`  ok  - ${name}`);
  else {
    console.error(`  FAIL - ${name}`);
    failures += 1;
  }
}

const source = fs.readFileSync(new URL("./useResumeStudio.js", import.meta.url), "utf8");

check("hook computes batch section target", source.includes("getPendingPatchPrimarySection"));
check("hook computes batch activity label", source.includes("describePendingPatch"));
check("hook avoids sectionId-only confirm text", source.includes("已接受 AI 改动并写入"));

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll useResumeStudio checks passed.");
