import { chmod, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceDir = process.env.WORKSPACE_DIR
  ? path.resolve(process.env.WORKSPACE_DIR)
  : path.resolve(__dirname, "../workspace");
const activeResumePath = path.join(workspaceDir, "active-resume.json");
const terminalAgentPath = path.join(workspaceDir, "resume-agent");
const activityLogPath = path.join(workspaceDir, "activity-log.ndjson");
const activityStatePath = path.join(workspaceDir, "activity-state.json");
const selectionStatePath = path.join(workspaceDir, "selection-state.json");
const materialsDir = path.join(workspaceDir, "materials");
const extractedDir = path.join(materialsDir, ".extracted");
const historyDir = path.join(workspaceDir, "history");

const newResumeTemplate = {
  name: "Your Name",
  title: "Target Role | Availability | Internship Duration",
  contact: "Phone | Email | Location",
  summary: "",
  experience: [
    {
      company: "Company Name",
      role: "Role Title",
      date: "YYYY.MM-YYYY.MM",
      details:
        "Describe your work with clear outcomes.\nUse one bullet or paragraph per line so AI edits can target individual lines."
    }
  ],
  projects: [
    {
      name: "Project Name",
      role: "",
      date: "",
      details: "Describe the project goal, your contribution, and measurable result."
    }
  ],
  avatar: null,
  education: [
    {
      school: "School Name",
      degree: "",
      major: "Major",
      date: "YYYY.MM-YYYY.MM",
      tag: ""
    }
  ],
  skills: [
    {
      category: "Tools",
      content: "Figma, Excel, SQL"
    }
  ],
  fieldStyles: {}
};

export async function ensureWorkspace() {
  await mkdir(workspaceDir, { recursive: true });
  await mkdir(materialsDir, { recursive: true });
  await mkdir(extractedDir, { recursive: true });
  await mkdir(historyDir, { recursive: true });
  await ensureTerminalAgent();
  await ensureActivityFiles();
  await ensureWorkspaceInstructions();
}

function safeSlug(text) {
  return (text || "resume")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5-_ ]/gi, "")
    .replace(/\s+/g, "-")
    .slice(0, 48) || "resume";
}

function safeArchiveFileName(text) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const slug = safeSlug(text || "snapshot");
  return `${stamp}-${slug}.json`;
}

function assertSafeArchiveName(fileName) {
  if (!fileName || path.basename(fileName) !== fileName || !fileName.endsWith(".json")) {
    throw new Error("Invalid archive file name");
  }
}

function assertSafeResumeDocumentName(fileName) {
  if (!fileName || path.basename(fileName) !== fileName || !fileName.endsWith(".rts.json")) {
    throw new Error("Invalid resume document file name");
  }
}

function cloneResume(value) {
  return JSON.parse(JSON.stringify(value));
}

export function wrapResumeDocument(resume) {
  const now = new Date().toISOString();
  return {
    version: 1,
    meta: {
      title: `${resume.name || "未命名"}-resume`,
      updatedAt: now,
      createdAt: now
    },
    template: {
      id: "editorial"
    },
    resume
  };
}

export async function writeActiveResume(resume) {
  await ensureWorkspace();
  await writeFile(activeResumePath, JSON.stringify(resume, null, 2), "utf8");
  return activeResumePath;
}

export async function readActiveResume() {
  await ensureWorkspace();
  const raw = await readFile(activeResumePath, "utf8");
  return JSON.parse(raw);
}

export async function ensureActiveResume(defaultResume) {
  await ensureWorkspace();
  try {
    return await readActiveResume();
  } catch {
    if (!defaultResume) {
      throw new Error("Active resume does not exist");
    }
    await writeActiveResume(defaultResume);
    return defaultResume;
  }
}

// Parse legacy "【教育背景】... \n ..." block into structured education entries.
// Best-effort: each non-empty line becomes one entry, school taken as the line.
function parseEduLines(text) {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({ school: line, degree: "", major: "", date: "", tag: "" }));
}

// Parse legacy "【专业技能】..." block into structured skill entries.
// Lines like "分类：内容" split into {category, content}; otherwise whole line is content.
function parseSkillLines(text) {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^(.+?)[：:]\s*(.+)$/);
      if (m) return { category: m[1].trim(), content: m[2].trim() };
      return { category: "", content: line };
    });
}

// One-time shape migration: bring a legacy resume (summary holding
// 【教育背景】/【专业技能】, no education/skills fields) onto the new contract.
// Falls back to defaultResume when the legacy text cannot be split reliably.
export function migrateResumeShape(resume, defaultResume) {
  if (!resume || typeof resume !== "object") {
    return defaultResume ? { ...defaultResume } : resume;
  }
  // Already new shape — only backfill missing optional fields.
  if (Array.isArray(resume.education) && Array.isArray(resume.skills)) {
    return resume;
  }

  const result = {
    ...resume,
    avatar: resume.avatar ?? null,
    education: Array.isArray(resume.education) ? resume.education : [],
    skills: Array.isArray(resume.skills) ? resume.skills : []
  };

  const summary = typeof resume.summary === "string" ? resume.summary : "";
  if (summary.includes("【教育背景】") && summary.includes("【专业技能】")) {
    try {
      const [eduPart, skillPart] = summary.split("【专业技能】");
      const eduText = eduPart.replace("【教育背景】", "").trim();
      const skillText = (skillPart || "").trim();
      result.education = parseEduLines(eduText);
      result.skills = parseSkillLines(skillText);
      result.summary = "";
      if (result.education.length === 0 && result.skills.length === 0) {
        // Could not extract anything meaningful — fall back to a clean default.
        return defaultResume ? { ...defaultResume } : result;
      }
      return result;
    } catch {
      return defaultResume ? { ...defaultResume } : result;
    }
  }

  return result;
}

// Migrate the on-disk active resume in place (with a one-time backup) if it is
// still in the legacy shape. Safe to call on every startup.
export async function migrateActiveResumeFile(defaultResume) {
  await ensureWorkspace();
  let current;
  try {
    current = await readActiveResume();
  } catch {
    return; // no active resume yet; ensureActiveResume handles creation
  }
  if (Array.isArray(current.education) && Array.isArray(current.skills)) {
    return; // already migrated
  }
  const migrated = migrateResumeShape(current, defaultResume);
  if (migrated === current) return;
  try {
    await writeFile(
      path.join(workspaceDir, "active-resume.bak.json"),
      JSON.stringify(current, null, 2),
      "utf8"
    );
  } catch {
    // backup is best-effort
  }
  await writeActiveResume(migrated);
}

async function ensureTerminalAgent() {
  const bridgeBinDir = process.env.RESUME_BRIDGE_BIN_DIR
    ? path.resolve(process.env.RESUME_BRIDGE_BIN_DIR)
    : path.join(__dirname, "bin");
  const agentSrcPath = path.join(bridgeBinDir, "resume-agent.cjs");
  const script = `#!/bin/zsh
# Resume Studio CLI Agent Wrapper
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
export WORKSPACE_DIR="$SCRIPT_DIR"
node "${agentSrcPath}" "$@"
`;
  await writeFile(terminalAgentPath, script, "utf8");
  await chmod(terminalAgentPath, 0o755);
}

async function ensureWorkspaceInstructions() {
  const claudeMdPath = path.join(workspaceDir, "CLAUDE.md");
  const readmeMdPath = path.join(workspaceDir, "README.md");

  const claudeMdContent = `# Resume Studio Agent Guide

You are running inside the local workspace of **Resume Studio** (终端简历编辑器).
The user is viewing a live-rendered GUI preview of their resume on the left side of their screen.

## What you can READ freely

- \`materials/.extracted/*.md\` — the user's real source material (internship docs,
  project notes, spreadsheets) already extracted into clean markdown. Start from
  \`materials/.extracted/index.md\`. If it is empty, ask the user to run \`resume-agent ingest\`.
- The user's project files / code in this workspace.
- \`active-resume.json\` — the current resume (READ ONLY, see below).

## How to WRITE to the resume (strict)

The resume is the user's asset. You MUST NOT modify it silently.

- **Do NOT edit \`active-resume.json\` directly.** Even though you can write files,
  writing this file is forbidden — it would bypass the user's review.
- To change resume body text (summary / experience / projects / education / skills),
  first READ the materials and WRITE the finished text yourself, then submit it
  through the MCP tool **\`propose_edit({ sectionId, index, field, content })\`**.
  - \`summary\`: plain text, no index/field.
  - \`experience\` / \`projects\`: arrays; use \`index\` + default field \`details\`.
  - \`education\`: array of { school, degree, major, date, tag }; use \`index\` + \`field\`
    (one of school/degree/major/date/tag).
  - \`skills\`: array of { category, content }; use \`index\` + \`field\` (category/content).
  - Proposing with index 0 onto an EMPTY array appends a new item.
- \`propose_edit\` stages a PENDING change. It does not take effect until the user
  clicks 「接受」 in the workbench (or runs \`resume-agent confirm\`). They may also reject it.
- For title / contact only, use \`set_title\` / \`set_contact\` (these are exact,
  deterministic values and apply directly). The avatar is uploaded by the user in
  the workbench — do NOT try to set it.

## Recommended flow

1. Read \`materials/.extracted/index.md\` and the relevant extracted files.
2. Understand what the user actually did; draft strong, outcome-oriented copy.
3. Call \`propose_edit\` with your finished text for one section at a time.
4. Wait for the user to accept or reject in the workbench.
`;

  const readmeMdContent = `# Resume Studio 工作区指南 (Agent Context)

欢迎来到 **Resume Studio** 本地工作台！

作为 AI 智能体（如 Codex, Antigravity, Claude Code），你正在通过终端访问用户的简历工作区。

## 你可以自由「读」

1. \`materials/.extracted/*.md\`：用户真实素材（实习文档、项目笔记、表格）已被抽取成干净的
   markdown。从 \`materials/.extracted/index.md\` 开始读。若为空，请提醒用户先运行
   \`resume-agent ingest\`。
2. 工作区里的项目文件 / 代码。
3. \`active-resume.json\`：当前简历内容（**只读**，见下）。

## 你「写」简历必须遵守（重要）

简历是用户的资产，**不允许在用户不知情时被改动**。

1. **禁止直接修改 \`active-resume.json\`**。即使你有文件写入能力，也不能写这个文件——那会绕过用户的审核。
2. 要修改正文（summary / experience / projects / education / skills）：先读素材、自己写好成品文案，然后通过 MCP 工具
   **\`propose_edit({ sectionId, index, field, content })\`** 提交。
   - \`summary\`：纯文本，无 index/field。
   - \`experience\` / \`projects\`：数组，用 \`index\` + 默认 field \`details\`。
   - \`education\`：数组 { school, degree, major, date, tag }，用 \`index\` + \`field\`（school/degree/major/date/tag 之一）。
   - \`skills\`：数组 { category, content }，用 \`index\` + \`field\`（category/content 之一）。
   - 对空数组用 index 0 提交，视为追加一条新项。
3. \`propose_edit\` 只会生成「待确认」改动，**用户在工作台点「接受」（或运行 \`resume-agent confirm\`）后才会真正写入**，用户也可以拒绝。
4. 仅 title / contact 用 \`set_title\` / \`set_contact\`（确定性值，直接生效）。头像由用户在工作台上传，**不要**尝试设置头像。

## 推荐流程

1. 读 \`materials/.extracted/index.md\` 及相关抽取文件。
2. 理解用户真正做过什么，写出结果导向的简历文案。
3. 每次针对一个 section 调用 \`propose_edit\` 提交你写好的文案。
4. 等用户在工作台接受或拒绝。
`;

  await writeFile(claudeMdPath, claudeMdContent, "utf8");
  await writeFile(readmeMdPath, readmeMdContent, "utf8");
}

async function ensureActivityFiles() {
  await writeFile(activityLogPath, "", { flag: "a" });
  try {
    const raw = await readFile(activityStatePath, "utf8");
    if (!raw.trim()) {
      throw new Error("empty");
    }
    JSON.parse(raw);
  } catch {
    await writeFile(
      activityStatePath,
      JSON.stringify({ session: null, lastCommand: "", updatedAt: null }, null, 2),
      "utf8"
    );
  }
}

export async function saveResumeDocument(resume, suggestedName) {
  await ensureWorkspace();
  const document = wrapResumeDocument(resume);
  const fileName = `${safeSlug(suggestedName || resume.name || "resume")}.rts.json`;
  const fullPath = path.join(workspaceDir, fileName);
  await writeFile(fullPath, JSON.stringify(document, null, 2), "utf8");
  await writeActiveResume(resume);
  return {
    fileName,
    fullPath,
    document
  };
}

export async function listResumeDocuments() {
  await ensureWorkspace();
  const files = await readdir(workspaceDir);
  const targetFiles = files.filter((file) => file.endsWith(".rts.json")).sort().reverse();
  const items = [];

  for (const fileName of targetFiles) {
    const fullPath = path.join(workspaceDir, fileName);
    const raw = await readFile(fullPath, "utf8");
    const parsed = JSON.parse(raw);
    items.push({
      fileName,
      fullPath,
      updatedAt: parsed?.meta?.updatedAt || null,
      title: parsed?.meta?.title || fileName
    });
  }

  return items;
}

export async function openResumeDocument(fileName) {
  await ensureWorkspace();
  assertSafeResumeDocumentName(fileName);
  const fullPath = path.join(workspaceDir, fileName);
  const raw = await readFile(fullPath, "utf8");
  const parsed = JSON.parse(raw);
  await writeActiveResume(parsed.resume);
  return {
    fileName,
    fullPath,
    document: parsed
  };
}

export async function createResumeArchive(reason = "manual") {
  await ensureWorkspace();
  const resume = await readActiveResume();
  const archivedAt = new Date().toISOString();
  const fileName = safeArchiveFileName(reason);
  const fullPath = path.join(historyDir, fileName);
  const archive = {
    version: 1,
    reason,
    archivedAt,
    resume
  };
  await writeFile(fullPath, JSON.stringify(archive, null, 2), "utf8");
  return {
    fileName,
    fullPath,
    reason,
    archivedAt,
    resume
  };
}

export async function listResumeArchives() {
  await ensureWorkspace();
  const files = await readdir(historyDir);
  const archives = [];

  for (const fileName of files.filter((file) => file.endsWith(".json"))) {
    try {
      assertSafeArchiveName(fileName);
      const fullPath = path.join(historyDir, fileName);
      const raw = await readFile(fullPath, "utf8");
      const parsed = JSON.parse(raw);
      archives.push({
        fileName,
        fullPath,
        reason: parsed.reason || "manual",
        archivedAt: parsed.archivedAt || null,
        resume: parsed.resume || null
      });
    } catch {
      // Ignore malformed archive files so one bad snapshot does not break history.
    }
  }

  return archives.sort((a, b) => String(b.archivedAt).localeCompare(String(a.archivedAt)));
}

export async function createNewResumeFromTemplate(reason = "new-resume") {
  const archived = await createResumeArchive(reason);
  const resume = cloneResume(newResumeTemplate);
  await writeActiveResume(resume);
  return { archived, resume };
}

export async function restoreResumeArchive(fileName, { archiveCurrent = true } = {}) {
  await ensureWorkspace();
  assertSafeArchiveName(fileName);
  const fullPath = path.join(historyDir, fileName);
  const raw = await readFile(fullPath, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed.resume || typeof parsed.resume !== "object") {
    throw new Error("Archive does not contain a resume");
  }

  const archived = archiveCurrent ? await createResumeArchive("before-restore") : null;
  await writeActiveResume(parsed.resume);
  return {
    fileName,
    fullPath,
    archived,
    resume: parsed.resume
  };
}

export async function writeSelectionState(selection) {
  await writeFile(selectionStatePath, JSON.stringify(selection, null, 2), "utf8");
}

export async function readSelectionState() {
  try {
    const raw = await readFile(selectionStatePath, "utf8");
    return raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export {
  activeResumePath,
  activityLogPath,
  activityStatePath,
  selectionStatePath,
  terminalAgentPath,
  historyDir,
  workspaceDir
};
