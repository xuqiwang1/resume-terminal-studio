// Verifies the pending-patch staging layer with content-based proposeEdit:
//  1. proposeEdit stages a patch WITHOUT touching active-resume.json
//  2. commit applies the agent-written content exactly
//  3. reject leaves the resume unchanged and clears the slot
//  4. experience index targeting is correct
//  5. the fake-rewrite engine (improveSentence) is gone
//  6. native CLI is gated: confirm/reject work, ask is removed
// Run: node bridge/bin/pending-patch.test.cjs
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "resume-pending-"));
process.env.WORKSPACE_DIR = tmp;

const seed = {
  name: "测试",
  title: "标题",
  contact: "联系方式",
  summary: "原始总结。",
  education: [
    { school: "甲大学", degree: "硕士", major: "社会学", date: "2025 - 2028", tag: "985" },
    { school: "乙大学", degree: "学士", major: "管理学", date: "2021 - 2025", tag: "211" }
  ],
  skills: [
    { category: "工具", content: "原始技能内容。" }
  ],
  experience: [
    { company: "A", role: "r", date: "d", details: "第一段经历。" },
    { company: "B", role: "r", date: "d", details: "第二段经历。" }
  ],
  projects: [{ name: "P", role: "r", date: "d", details: "项目。" }]
};
fs.writeFileSync(path.join(tmp, "active-resume.json"), JSON.stringify(seed, null, 2));

const engine = require("./resume-engine.cjs");

let failures = 0;
function check(name, cond) {
  if (cond) {
    console.log(`  ok  - ${name}`);
  } else {
    console.error(`  FAIL - ${name}`);
    failures += 1;
  }
}
function diskResume() {
  return JSON.parse(fs.readFileSync(path.join(tmp, "active-resume.json"), "utf8"));
}

// 0. the fake-rewrite engine must be gone
check("improveSentence is removed from engine", engine.improveSentence === undefined);
check("applyInstruction is removed from engine", engine.applyInstruction === undefined);
check("proposeEdit is exported", typeof engine.proposeEdit === "function");

// 1. proposeEdit stages without writing
const SUMMARY_TEXT = "Agent 写好的全新个人总结：聚焦 AI 产品方向。";
const before = JSON.stringify(diskResume());
const { pending } = engine.proposeEdit({ sectionId: "summary", content: SUMMARY_TEXT });
check("proposeEdit returns a pendingId", !!pending.id);
check("proposeEdit stores agent content verbatim", pending.after === SUMMARY_TEXT);
check("proposeEdit does NOT modify active-resume.json", JSON.stringify(diskResume()) === before);
check("pending slot is populated", !!engine.readPendingPatch());

// 2. commit applies exactly
engine.commitPatch(pending.id);
check("commit writes the agent content to summary", diskResume().summary === SUMMARY_TEXT);
check("commit clears the pending slot", !engine.readPendingPatch());

// 3. reject leaves resume unchanged
const beforeReject = JSON.stringify(diskResume());
const p2 = engine.proposeEdit({ sectionId: "projects", content: "新项目文案。" });
check("propose (2) does NOT modify resume", JSON.stringify(diskResume()) === beforeReject);
engine.rejectPatch(p2.pending.id);
check("reject leaves resume unchanged", JSON.stringify(diskResume()) === beforeReject);
check("reject clears the pending slot", !engine.readPendingPatch());

// 4. experience index targeting
const EXP1 = "针对第二段经历写好的新文案。";
const p3 = engine.proposeEdit({ sectionId: "experience", index: 1, content: EXP1 });
check("proposeEdit targets experience index 1", p3.pending.sectionId === "experience" && p3.pending.index === 1);
engine.commitPatch(p3.pending.id);
check("commit applies to experience[1], not [0]", diskResume().experience[1].details === EXP1);
check("experience[0] untouched", diskResume().experience[0].details === "第一段经历。");

// 4b. invalid target is rejected
let threw = false;
try {
  engine.proposeEdit({ sectionId: "experience", index: 9, content: "x" });
} catch {
  threw = true;
}
check("proposeEdit throws on out-of-range index", threw);

// 4c. title/contact must also be staged, never written directly by an agent.
const beforeTitle = JSON.stringify(diskResume());
const pt = engine.proposeEdit({ sectionId: "title", content: "AI 产品经理 | 一周内到岗" });
check("title propose is staged as pending", pt.pending.sectionId === "title");
check("title propose does NOT write disk", JSON.stringify(diskResume()) === beforeTitle);
engine.commitPatch(pt.pending.id);
check("title commit writes only after confirmation", diskResume().title === "AI 产品经理 | 一周内到岗");

const beforeContact = JSON.stringify(diskResume());
const pc = engine.proposeEdit({ sectionId: "contact", content: "Phone | Email | Location" });
check("contact propose is staged as pending", pc.pending.sectionId === "contact");
check("contact propose does NOT write disk", JSON.stringify(diskResume()) === beforeContact);
engine.rejectPatch(pc.pending.id);
check("contact reject leaves resume unchanged", JSON.stringify(diskResume()) === beforeContact);

// ─── Structured sections: education / skills ───

// 6. education: propose to index 0 sub-field stages without writing
const EDU_SCHOOL = "丙大学（改后）";
const beforeEdu = JSON.stringify(diskResume());
const pe = engine.proposeEdit({ sectionId: "education", index: 0, field: "school", content: EDU_SCHOOL });
check("education propose stores field", pe.pending.sectionId === "education" && pe.pending.field === "school");
check("education propose does NOT write disk", JSON.stringify(diskResume()) === beforeEdu);
engine.commitPatch(pe.pending.id);
check("education commit applies to education[0].school", diskResume().education[0].school === EDU_SCHOOL);
check("education[0] other fields untouched", diskResume().education[0].degree === "硕士" && diskResume().education[0].major === "社会学");
check("education[1] untouched after index-0 commit", diskResume().education[1].school === "乙大学");

// 7. education index 1 targeting does not disturb index 0
const EDU_MAJOR1 = "公共管理";
const pe2 = engine.proposeEdit({ sectionId: "education", index: 1, field: "major", content: EDU_MAJOR1 });
engine.commitPatch(pe2.pending.id);
check("education commit applies to education[1].major", diskResume().education[1].major === EDU_MAJOR1);
check("education[0].school unchanged by index-1 commit", diskResume().education[0].school === EDU_SCHOOL);

// 8. skills: propose + commit on content field
const SKILL_CONTENT = "改写后的技能内容。";
const ps = engine.proposeEdit({ sectionId: "skills", index: 0, field: "content", content: SKILL_CONTENT });
check("skills propose defaults/accepts content field", ps.pending.field === "content");
engine.commitPatch(ps.pending.id);
check("skills commit applies to skills[0].content", diskResume().skills[0].content === SKILL_CONTENT);

// 8b. skills field defaults to content when omitted
const ps2 = engine.proposeEdit({ sectionId: "skills", index: 0, content: "再次改写。" });
check("skills field defaults to content", ps2.pending.field === "content");
engine.rejectPatch(ps2.pending.id);

// 9. empty array + index 0 => append a new item
const tmpEmpty = fs.mkdtempSync(path.join(os.tmpdir(), "resume-append-"));
const seedEmpty = { ...JSON.parse(JSON.stringify(seed)), education: [], skills: [] };
fs.writeFileSync(path.join(tmpEmpty, "active-resume.json"), JSON.stringify(seedEmpty, null, 2));
// Re-require engine in the empty workspace via a child process to avoid module path caching.
{
  const { execFileSync } = require("node:child_process");
  const script = `
    process.env.WORKSPACE_DIR = ${JSON.stringify(tmpEmpty)};
    const e = require(${JSON.stringify(path.join(__dirname, "resume-engine.cjs"))});
    const p = e.proposeEdit({ sectionId: "education", index: 0, field: "school", content: "新校" });
    if (!p.pending.append) { console.error("NO_APPEND"); process.exit(2); }
    e.commitPatch(p.pending.id);
    const r = JSON.parse(require("fs").readFileSync(${JSON.stringify(path.join(tmpEmpty, "active-resume.json"))}, "utf8"));
    if (r.education.length !== 1 || r.education[0].school !== "新校") { console.error("BAD_APPEND"); process.exit(3); }
    process.exit(0);
  `;
  let appendOk = true;
  try {
    execFileSync("node", ["-e", script], { encoding: "utf8" });
  } catch {
    appendOk = false;
  }
  check("empty array + index 0 appends a new item", appendOk);
  fs.rmSync(tmpEmpty, { recursive: true, force: true });
}

// 10. invalid sub-field is rejected
let threwField = false;
try {
  engine.proposeEdit({ sectionId: "education", index: 0, field: "nope", content: "x" });
} catch {
  threwField = true;
}
check("education rejects invalid sub-field", threwField);

// 11. out-of-range index on non-empty array is rejected
let threwEduRange = false;
try {
  engine.proposeEdit({ sectionId: "skills", index: 9, field: "content", content: "x" });
} catch {
  threwEduRange = true;
}
check("skills rejects out-of-range index", threwEduRange);

// 5. native terminal CLI is gated
const { execFileSync } = require("node:child_process");
const agentPath = path.join(__dirname, "resume-agent.cjs");
const runAgent = (...cliArgs) =>
  execFileSync("node", [agentPath, ...cliArgs], {
    env: { ...process.env, WORKSPACE_DIR: tmp },
    encoding: "utf8"
  });

// ask must be gone
let askFailed = false;
try {
  runAgent("ask", "随便改改");
} catch {
  askFailed = true;
}
check("CLI ask is removed (errors out)", askFailed);

// confirm/reject must not be available to agents through Bash.
const beforeCli = JSON.stringify(diskResume());
const cliPending = engine.proposeEdit({ sectionId: "summary", content: "CLI 不应确认的新总结。" });
check("CLI: staged patch does not modify resume", JSON.stringify(diskResume()) === beforeCli);
let cliConfirmFailed = false;
try {
  runAgent("confirm");
} catch {
  cliConfirmFailed = true;
}
check("CLI confirm is removed (cannot bypass app approval)", cliConfirmFailed);
check("CLI confirm does not write the resume", JSON.stringify(diskResume()) === beforeCli);
check("CLI confirm leaves pending patch for the app", engine.readPendingPatch()?.id === cliPending.pending.id);
engine.rejectPatch(cliPending.pending.id);

const rejectPending = engine.proposeEdit({ sectionId: "summary", content: "CLI 不应拒绝的新总结。" });
const beforeCliReject = JSON.stringify(diskResume());
let cliRejectFailed = false;
try {
  runAgent("reject");
} catch {
  cliRejectFailed = true;
}
check("CLI reject is removed (cannot bypass app approval)", cliRejectFailed);
check("CLI reject leaves resume unchanged", JSON.stringify(diskResume()) === beforeCliReject);
check("CLI reject leaves pending patch for the app", engine.readPendingPatch()?.id === rejectPending.pending.id);
engine.rejectPatch(rejectPending.pending.id);

// title/contact CLI commands stage pending patches instead of writing directly.
const beforeCliTitle = JSON.stringify(diskResume());
runAgent("title", "CLI 暂存标题");
check("CLI title does not write directly", JSON.stringify(diskResume()) === beforeCliTitle);
const cliTitlePatch = engine.readPendingPatch();
check("CLI title creates a pending title patch", cliTitlePatch?.sectionId === "title");
if (cliTitlePatch) engine.rejectPatch(cliTitlePatch.id);

const beforeCliContact = JSON.stringify(diskResume());
runAgent("contact", "CLI 暂存联系方式");
check("CLI contact does not write directly", JSON.stringify(diskResume()) === beforeCliContact);
const cliContactPatch = engine.readPendingPatch();
check("CLI contact creates a pending contact patch", cliContactPatch?.sectionId === "contact");
if (cliContactPatch) engine.rejectPatch(cliContactPatch.id);

fs.rmSync(tmp, { recursive: true, force: true });

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll pending-patch checks passed.");
