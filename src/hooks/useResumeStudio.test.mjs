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
check("hook restores avatar position from merged resume snapshots", source.includes("mergedResume?.avatarPos"));
check("default layout config includes link style", source.includes('linkStyle: { mode: "default", color: "#0645ad", underline: true }'));
check("hook persists layout config in resume state", source.includes("layoutConfig: next"));
check("hook restores layout config from merged resume snapshots", source.includes("mergedResume?.layoutConfig"));
check("hook normalizes persisted style settings", source.includes("normalizeStyleSettings"));
check("hook persists style settings in resume state", source.includes("styleSettings: next"));
check("hook restores style settings from merged resume snapshots", source.includes("mergedResume?.styleSettings"));
check("template switching goes through the preset carry-over helper", source.includes("applyTemplatePreset(current, nextTemplate.id)"));
check("style autosave is debounced", source.includes("STYLE_AUTOSAVE_DELAY_MS") && source.includes("setTimeout"));
check("style autosave uses the presentation-only endpoint", source.includes("saveStyleSettings(styleSettings)"));
check("hook imports guarded snapshot merge helper", source.includes('import { mergeResumeSnapshot } from "./resumeSnapshotMerge";'));
check("applyResumeSnapshot tracks the current in-memory resume", source.includes("const resumeRef = useRef(initialResume);"));
check("applyResumeSnapshot merges incoming snapshots instead of replacing resume directly", source.includes("const mergedResume = mergeResumeSnapshot(resumeRef.current, nextResume);"));
check("applyResumeSnapshot no longer directly sets incoming snapshot as full state", !source.includes("setResume(nextResume);"));

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll useResumeStudio checks passed.");
