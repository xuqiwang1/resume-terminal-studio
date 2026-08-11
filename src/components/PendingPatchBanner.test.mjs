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
check("banner uses shared section formatter", source.includes("formatSectionLabel"));
check("banner uses shared change label formatter", source.includes("formatPendingChangeLabel"));
check("banner uses shared value formatter", source.includes("formatPendingValue"));
check("banner does not keep local section label map", !source.includes("const SECTION_LABELS"));
check("banner does not keep local field label map", !source.includes("const FIELD_LABELS"));
check("banner renders evidence from pending patch", source.includes("pending.evidence"));
check("banner labels evidence as source materials", source.includes("依据材料"));
check("banner renders risk level from pending patch", source.includes("pending.riskLevel"));
check("banner warns for high-risk patches", source.includes("本次会替换或新增整条结构化内容"));
check("banner renders before-accept checkpoints", source.includes("pending-checkpoints"));
check("banner requires high-risk acknowledgement", source.includes("highRiskAcknowledged"));
check("banner warns when evidence is missing", source.includes("没有来源材料标注"));
check("css defines batch group layout", css.includes(".pending-batch-group"));
check("css defines batch change rows", css.includes(".pending-batch-change"));
check("css defines scrollable pending body", css.includes(".pending-body") && css.includes("overflow-y: auto"));
check("css defines readable pending value blocks", css.includes(".pending-value-block"));
check("css defines pending evidence block", css.includes(".pending-evidence"));
check("css defines pending risk badges", css.includes(".pending-risk-high"));
check("css defines pending checkpoints", css.includes(".pending-checkpoints"));
check("css defines disabled accept state", css.includes(".pending-accept:disabled"));
check("banner accepts a conflict list", source.includes("conflicts = []"));
check("banner renders the conflict notice", source.includes("<PendingConflictNotice conflicts={conflicts} />"));
check("conflict notice shows both the recorded and the current text", source.includes('label="AI 提出时的原文"') && source.includes('label="当前内容"'));
check("conflict blocks accept until acknowledged", source.includes("hasConflict && !conflictAcknowledged"));
check("conflict acknowledgement resets per patch", source.includes("setConflictAcknowledged(false)"));
check("accepting a conflicting patch is an explicit overwrite", source.includes("onConfirm?.({ force: hasConflict })"));
check("css defines the conflict notice", css.includes(".pending-conflict {") && css.includes(".pending-conflict-target"));

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll PendingPatchBanner checks passed.");
