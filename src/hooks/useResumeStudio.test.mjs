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
check("hook normalizes pending section target", source.includes("normalizePendingSection"));
check("hook computes batch activity label", source.includes("describePendingPatch"));
check("hook avoids sectionId-only confirm text", source.includes("已接受 AI 改动并写入"));
check("hook imports fetchPendingPatch", source.includes("fetchPendingPatch"));
check("hook imports fetchContext", source.includes("fetchContext"));
check("hook fetches pending on initial load", source.includes("fetchPendingPatch()"));
check("hook records pending fetch errors", source.includes("读取待确认改动失败"));
check("hook syncs active document after initial resume load", source.includes("syncDocumentState(") && source.includes("data.activeResumePath || \"\""));
check("hook preserves existing startup document", source.includes("sameActivePath"));
check("hook does not compute documentId client-side", !source.includes("const documentId ="));
check("hook does not compute revision client-side", !source.includes("revision: documentId.length"));
check("hook syncs activeResumePath", source.includes("activeResumePath"));
check("hook keeps header selection distinct from summary", !source.includes('sectionId === "header" ? "summary" : sectionId'));
check("hook maps intent targets through pending section normalization", source.includes("setWorkingSection(normalizePendingSection(event.target))"));
check("hook maps patch targets through pending section normalization", source.includes("const resolvedSection = normalizePendingSection(event.sectionId)"));
check("hook persists avatar position in resume state", source.includes("avatarPos: next"));
check("hook restores avatar position from resume snapshots", source.includes("nextResume?.avatarPos"));
check("hook persists layout config in resume state", source.includes("layoutConfig: next"));
check("hook restores layout config from resume snapshots", source.includes("nextResume?.layoutConfig"));

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll useResumeStudio checks passed.");
