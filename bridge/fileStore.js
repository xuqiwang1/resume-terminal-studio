import { chmod, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import defaultResumeModule from "./defaultResume.cjs";
import workspacePathModule from "./workspacePath.cjs";
import atomicFileModule from "./core/atomicFile.cjs";
import { getAgentGuideContent, getWorkspaceReadmeContent } from "./workspaceInstructions.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { createDefaultResume } = defaultResumeModule;
const { resolveWorkspaceDir } = workspacePathModule;
const { writeFileAtomic, writeJsonAtomic } = atomicFileModule;
const workspaceDir = resolveWorkspaceDir(process.env, __dirname);
const activeResumePath = path.join(workspaceDir, "active-resume.json");
const terminalAgentPath = path.join(workspaceDir, "resume-agent");
const activityLogPath = path.join(workspaceDir, "activity-log.ndjson");
const activityStatePath = path.join(workspaceDir, "activity-state.json");
const selectionStatePath = path.join(workspaceDir, "selection-state.json");
const contextStatePath = path.join(workspaceDir, "context-state.json");
const materialsDir = path.join(workspaceDir, "materials");
const extractedDir = path.join(materialsDir, ".extracted");
const historyDir = path.join(workspaceDir, "history");

const newResumeTemplate = createDefaultResume();

const DEFAULT_CONTEXT_STATE = {
  version: 1,
  updatedAt: null,
  document: {
    documentId: "template:active",
    mode: "template",
    fileName: "",
    historyFileName: "",
    title: "Your Name-resume",
    activeResumePath: "",
    revision: 0
  },
  view: { visiblePage: 1, pageCount: 1, scrollTop: 0, zoom: "width", scale: 1 },
  selection: {
    fieldId: null,
    sectionId: null,
    index: null,
    field: null,
    sectionLabel: "",
    fieldLabel: "",
    textPreview: ""
  }
};

export async function ensureWorkspace({ initialize = true } = {}) {
  await mkdir(workspaceDir, { recursive: true });
  await mkdir(materialsDir, { recursive: true });
  await mkdir(extractedDir, { recursive: true });
  await mkdir(historyDir, { recursive: true });
  if (!initialize) return;
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

// Two archives created inside the same millisecond used to resolve to the same name,
// so the second silently overwrote the first. Probing with stat() first is racy —
// concurrent callers all see the name as free — so claim it with an exclusive create
// and let EEXIST drive the retry.
async function writeArchiveExclusive(reason, archive) {
  const base = safeArchiveFileName(reason);
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const fileName = attempt === 0 ? base : base.replace(/\.json$/, `-${attempt}.json`);
    const fullPath = path.join(historyDir, fileName);
    try {
      await writeFile(fullPath, JSON.stringify(archive, null, 2), { encoding: "utf8", flag: "wx" });
      return { fileName, fullPath };
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  }
  const fileName = base.replace(/\.json$/, `-${process.pid}-${Date.now()}.json`);
  const fullPath = path.join(historyDir, fileName);
  await writeFile(fullPath, JSON.stringify(archive, null, 2), "utf8");
  return { fileName, fullPath };
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

function safeBaseName(value) {
  if (!value) return "";
  return path.basename(String(value));
}

function clampTextPreview(value) {
  return String(value || "").slice(0, 400);
}

function normalizeRevision(value) {
  const revision = Number(value);
  return Number.isFinite(revision) && revision >= 0 ? Math.floor(revision) : 0;
}

function normalizeContextState(input = {}) {
  const current = {
    ...DEFAULT_CONTEXT_STATE,
    ...input,
    document: { ...DEFAULT_CONTEXT_STATE.document, ...(input.document || {}) },
    view: { ...DEFAULT_CONTEXT_STATE.view, ...(input.view || {}) },
    selection: { ...DEFAULT_CONTEXT_STATE.selection, ...(input.selection || {}) }
  };
  const mode = ["template", "file", "history"].includes(current.document.mode)
    ? current.document.mode
    : "template";
  const zoom =
    current.view.zoom === "fit" || current.view.zoom === "width" || typeof current.view.zoom === "number"
      ? current.view.zoom
      : "width";
  const fieldId = current.selection.fieldId || null;

  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    document: {
      documentId: String(current.document.documentId || `${mode}:${current.document.fileName || current.document.historyFileName || "active"}`).slice(0, 200),
      mode,
      fileName: safeBaseName(current.document.fileName),
      historyFileName: safeBaseName(current.document.historyFileName),
      title: String(current.document.title || ""),
      activeResumePath: String(current.document.activeResumePath || activeResumePath),
      revision: normalizeRevision(current.document.revision)
    },
    view: {
      visiblePage: Math.max(1, Number(current.view.visiblePage) || 1),
      pageCount: Math.max(1, Number(current.view.pageCount) || 1),
      scrollTop: Math.max(0, Number(current.view.scrollTop) || 0),
      zoom,
      scale: Math.max(0.2, Math.min(2, Number(current.view.scale) || 1))
    },
    selection: {
      fieldId,
      sectionId: current.selection.sectionId || null,
      index: fieldId && Number.isInteger(current.selection.index) ? current.selection.index : null,
      field: fieldId ? current.selection.field || null : null,
      sectionLabel: current.selection.sectionId ? String(current.selection.sectionLabel || "") : "",
      fieldLabel: fieldId ? String(current.selection.fieldLabel || "") : "",
      textPreview: fieldId ? clampTextPreview(current.selection.textPreview) : ""
    }
  };
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
      id: "professional"
    },
    resume
  };
}

export async function writeActiveResume(resume) {
  if (!resume || typeof resume !== "object") {
    throw new Error("writeActiveResume requires a resume object");
  }
  await ensureWorkspace();
  // Atomic: a reader (the workbench stream, the CLI, an agent) sees either the
  // whole previous resume or the whole new one. The plain writeFile this replaced
  // is what readActiveResumeRobust()'s retry loop was working around.
  await writeJsonAtomic(activeResumePath, resume);
  return activeResumePath;
}

export async function readContextState() {
  await ensureWorkspace({ initialize: false });
  try {
    const raw = await readFile(contextStatePath, "utf8");
    return normalizeContextState(raw.trim() ? JSON.parse(raw) : {});
  } catch {
    return normalizeContextState({});
  }
}

export async function writeContextState(patch = {}) {
  const current = await readContextState();
  const next = normalizeContextState({
    ...current,
    ...patch,
    document: { ...current.document, ...(patch.document || {}) },
    view: { ...current.view, ...(patch.view || {}) },
    selection: { ...current.selection, ...(patch.selection || {}) }
  });
  await writeJsonAtomic(contextStatePath, next);
  return next;
}

export async function readActiveResume() {
  await ensureWorkspace({ initialize: false });
  const raw = await readFile(activeResumePath, "utf8");
  const parsed = JSON.parse(raw);
  // An array or a bare string parses fine but is not a resume, and letting one
  // through turns every later `resume.experience` into undefined.
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${activeResumePath} does not contain a resume object`);
  }
  return parsed;
}

// "Missing" and "unreadable" used to share one catch block, so a resume damaged
// by a crashed write was replaced by the blank template on the next launch and the
// user's content was gone. A damaged file is now moved aside before the template
// is written, so the bytes are still there to recover from.
export async function ensureActiveResume(defaultResume) {
  await ensureWorkspace();
  try {
    return await readActiveResume();
  } catch (error) {
    if (!defaultResume) {
      throw new Error("Active resume does not exist");
    }
    if (error.code !== "ENOENT") {
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const quarantinePath = `${activeResumePath}.corrupt-${stamp}`;
      try {
        await rm(quarantinePath, { force: true });
        const raw = await readFile(activeResumePath, "utf8");
        await writeFileAtomic(quarantinePath, raw);
        console.error(
          `[resume-studio] ${activeResumePath} was unreadable (${error.message}); ` +
            `preserved a copy at ${quarantinePath} before writing a blank resume.`
        );
      } catch {
        // If even the copy fails we still must not leave the app without a resume.
      }
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
    await writeJsonAtomic(path.join(workspaceDir, "active-resume.bak.json"), current);
  } catch {
    // backup is best-effort
  }
  await writeActiveResume(migrated);
}

// Nearly every store function calls ensureWorkspace(), so rewriting and
// chmod-ing these files unconditionally meant dozens of writes per session.
// Writing only on an actual content change makes the calls idempotent.
async function writeFileIfChanged(filePath, content) {
  try {
    if ((await readFile(filePath, "utf8")) === content) return false;
  } catch {
    // Missing or unreadable — write it.
  }
  await writeFileAtomic(filePath, content);
  return true;
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
  if (await writeFileIfChanged(terminalAgentPath, script)) {
    await chmod(terminalAgentPath, 0o755);
  }
}

// These files live in the user's workspace, which is a directory they own and
// may edit. Overwriting them on every startup silently discarded any note they
// had added. The generated guide is kept in its own file, and the agent-facing
// entry points are only created when absent.
const GENERATED_GUIDE_FILE = "RESUME-STUDIO-GUIDE.md";

async function ensureWorkspaceInstructions() {
  const agentGuideContent = getAgentGuideContent();
  const readmeMdContent = getWorkspaceReadmeContent();

  // Always current: this file is ours and is documented as generated.
  await writeFileIfChanged(path.join(workspaceDir, GENERATED_GUIDE_FILE), agentGuideContent);

  for (const name of ["CLAUDE.md", "AGENTS.md"]) {
    const target = path.join(workspaceDir, name);
    try {
      await readFile(target, "utf8");
    } catch {
      await writeFileAtomic(target, agentGuideContent);
    }
  }

  const readmePath = path.join(workspaceDir, "README.md");
  try {
    await readFile(readmePath, "utf8");
  } catch {
    await writeFileAtomic(readmePath, readmeMdContent);
  }
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
    await writeJsonAtomic(activityStatePath, { session: null, lastCommand: "", updatedAt: null });
  }
}

export async function saveResumeDocument(resume, suggestedName) {
  if (!resume || typeof resume !== "object" || Array.isArray(resume)) {
    throw new Error("saveResumeDocument requires a resume object");
  }
  await ensureWorkspace();
  const document = wrapResumeDocument(resume);
  const fileName = `${safeSlug(suggestedName || resume.name || "resume")}.rts.json`;
  const fullPath = path.join(workspaceDir, fileName);
  await writeJsonAtomic(fullPath, document);
  await writeActiveResume(resume);
  return {
    fileName,
    fullPath,
    document
  };
}

export async function listResumeDocuments() {
  await ensureWorkspace({ initialize: false });
  const files = await readdir(workspaceDir);
  const targetFiles = files.filter((file) => file.endsWith(".rts.json")).sort().reverse();
  const items = [];

  for (const fileName of targetFiles) {
    const fullPath = path.join(workspaceDir, fileName);
    // An unguarded JSON.parse here meant a single damaged .rts.json made the whole
    // file list — and the panel that renders it — fail to load. A bad document is
    // listed as unreadable so the user can still see and delete it.
    try {
      const raw = await readFile(fullPath, "utf8");
      const parsed = JSON.parse(raw);
      items.push({
        fileName,
        fullPath,
        updatedAt: parsed?.meta?.updatedAt || null,
        title: parsed?.meta?.title || fileName
      });
    } catch (error) {
      items.push({
        fileName,
        fullPath,
        updatedAt: null,
        title: fileName,
        unreadable: true,
        error: error.message
      });
    }
  }

  return items;
}

export async function openResumeDocument(fileName) {
  await ensureWorkspace();
  assertSafeResumeDocumentName(fileName);
  const fullPath = path.join(workspaceDir, fileName);
  const raw = await readFile(fullPath, "utf8");
  const parsed = JSON.parse(raw);
  // Without this, a document whose `resume` key is missing used to overwrite the
  // active resume with undefined and blank the workbench.
  if (!parsed?.resume || typeof parsed.resume !== "object" || Array.isArray(parsed.resume)) {
    throw new Error(`${fileName} does not contain a resume`);
  }
  await writeActiveResume(parsed.resume);
  return {
    fileName,
    fullPath,
    document: parsed
  };
}

// Auto checkpoints (one per accepted AI patch) would otherwise grow without bound.
// Manual snapshots are never pruned — the user asked for those on purpose.
export const AUTO_ARCHIVE_REASON = "before-ai-patch";
const AUTO_ARCHIVE_KEEP = 40;

async function pruneAutoArchives() {
  const archives = await listResumeArchives();
  const auto = archives.filter((archive) => archive.reason === AUTO_ARCHIVE_REASON);
  const stale = auto.slice(AUTO_ARCHIVE_KEEP);
  for (const archive of stale) {
    try {
      await rm(archive.fullPath, { force: true });
    } catch {
      // A checkpoint we cannot delete is not worth failing an accept over.
    }
  }
  return stale.length;
}

// `resume` lets a caller archive state it holds in memory. The confirm route needs
// this: the workbench's copy (with unsaved styling) is what the user is looking at,
// and it is not on disk yet.
export async function createResumeArchive(reason = "manual", { resume: providedResume, prune = false } = {}) {
  await ensureWorkspace();
  const resume = providedResume || (await readActiveResume());
  const archivedAt = new Date().toISOString();
  const archive = {
    version: 1,
    reason,
    archivedAt,
    resume
  };
  const { fileName, fullPath } = await writeArchiveExclusive(reason, archive);
  if (prune) await pruneAutoArchives();
  return {
    fileName,
    fullPath,
    reason,
    archivedAt,
    resume
  };
}

export async function listResumeArchives() {
  await ensureWorkspace({ initialize: false });
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
  await writeJsonAtomic(selectionStatePath, selection);
  await writeContextState({ selection });
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
  contextStatePath,
  selectionStatePath,
  terminalAgentPath,
  historyDir,
  workspaceDir
};
