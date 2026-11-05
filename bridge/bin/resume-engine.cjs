const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { createEventBus } = require("../core/eventBus.cjs");
const { createPersistence } = require("../core/persistence.cjs");
const { createResumeCore } = require("../core/resumeCore.cjs");
const { writeFileAtomicSync, writeJsonAtomicSync, readJsonSync } = require("../core/atomicFile.cjs");
const { resolveWorkspaceDir } = require("../workspacePath.cjs");

const workspaceDir = resolveWorkspaceDir(process.env, path.resolve(__dirname, ".."));
const activeResumePath = path.join(workspaceDir, "active-resume.json");
const activityLogPath = path.join(workspaceDir, "activity-log.ndjson");
const activityStatePath = path.join(workspaceDir, "activity-state.json");
const pendingPatchPath = path.join(workspaceDir, "pending-patch.json");
const materialsDir = path.join(workspaceDir, "materials");
const extractedDir = path.join(materialsDir, ".extracted");

function loadResume() {
  return JSON.parse(fs.readFileSync(activeResumePath, "utf8"));
}

function saveResume(resume) {
  writeJsonAtomicSync(activeResumePath, resume);
}

function readActivityState() {
  return readJsonSync(activityStatePath, { fallback: {} }).value;
}

function readActivityEvents(limit = 20) {
  let raw;
  try {
    raw = fs.readFileSync(activityLogPath, "utf8");
  } catch {
    return [];
  }
  // One malformed line used to discard the entire activity history, because the
  // JSON.parse sat inside the same try as the file read. Bad lines are skipped.
  const events = [];
  const lines = raw.split("\n");
  for (const line of lines.slice(-Math.max(limit * 4, limit))) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      events.push(JSON.parse(trimmed));
    } catch {
      // Skip a torn or hand-edited line rather than losing the whole log.
    }
  }
  return events.slice(-limit);
}

function updateActivityState(patch) {
  const current = readActivityState();
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
  writeJsonAtomicSync(activityStatePath, next);
  return next;
}

function appendActivity(event) {
  fs.appendFileSync(activityLogPath, `${JSON.stringify(event)}\n`);
}

function logPatch(sessionId, sectionId, before, after) {
  appendActivity({
    type: "patch",
    sessionId,
    sectionId,
    before,
    after,
    at: new Date().toISOString()
  });
}

function startCommandSession(rawCommand, meta = {}) {
  const sessionId = crypto.randomUUID();
  appendActivity({
    type: "command:start",
    sessionId,
    command: meta.command || "unknown",
    args: meta.args || [],
    at: new Date().toISOString()
  });
  updateActivityState({
    session: sessionId,
    lastCommand: rawCommand,
    status: "running"
  });
  return sessionId;
}

function endCommandSession(sessionId, rawCommand, ok) {
  appendActivity({
    type: "command:end",
    sessionId,
    command: rawCommand.split(" ")[1] || "unknown",
    ok,
    at: new Date().toISOString()
  });
  updateActivityState({
    session: sessionId,
    lastCommand: rawCommand,
    status: ok ? "completed" : "failed"
  });
}

// ---- Pending patch staging layer ----
// Single-slot staging: an AI-proposed change waits here until the user
// confirms (commit) or rejects it. Until then active-resume.json is untouched.

function readPendingPatch() {
  return readJsonSync(pendingPatchPath, { fallback: null }).value;
}

function writePendingPatch(pending) {
  writeJsonAtomicSync(pendingPatchPath, pending);
}

function clearPendingPatch() {
  // Silently swallowing this meant a user who clicked "reject" could be told it
  // worked while the patch stayed on disk and reappeared on the next read.
  writeFileAtomicSync(pendingPatchPath, "");
}

// One core per process, not one per call. Building a fresh core (and a fresh
// event bus) inside every propose/commit/reject meant no subscriber ever saw an
// event and the document revision restarted at 0 each time, which in turn made
// staleness checks meaningless.
let engineCore = null;

function createEngineCore() {
  if (engineCore) return engineCore;

  const persistence = createPersistence({ workspaceDir });
  const bus = createEventBus();
  const core = createResumeCore({ bus, persistence });
  if (!core.getActiveDocument()?.activeResumePath) {
    core.hydrateActiveDocument({
      documentId: "workspace:active-resume",
      mode: "workspace",
      fileName: "",
      historyFileName: "",
      title: "active-resume",
      activeResumePath,
      revision: 0
    });
  }
  engineCore = { bus, core, persistence };
  return engineCore;
}

function resetEngineCoreForTests() {
  engineCore = null;
}

// The engine and the HTTP server used to hold independent copies of the resume,
// so a CLI propose and an app confirm could disagree about what was on disk.
// Re-reading before a propose keeps the recorded `before` honest.
function syncCoreFromDisk(core) {
  try {
    core.hydrateResume(loadResume());
  } catch {
    // No readable resume on disk yet; the core keeps whatever it loaded.
  }
  core.hydratePendingPatch(readPendingPatch());
}

// Step 1: an agent proposes a finished edit. The agent (Codex/Claude) has
// already read the user's materials and WRITTEN the new text itself; the
// engine adds no "intelligence" — it only validates the target, records the
// before-value, and stores the proposal in the single pending slot.
// It does NOT write active-resume.json.
function proposeEdit(
  { sectionId, index = 0, field, content, bulletIndex, replace = false },
  sessionId = crypto.randomUUID()
) {
  const { core } = createEngineCore();
  syncCoreFromDisk(core);
  const pending = core.proposeSectionEdit({
    sessionId,
    sectionId,
    index,
    field,
    bulletIndex,
    content,
    replace
  });
  appendActivity({
    type: "proposed",
    sessionId,
    pendingId: pending.id,
    sectionId,
    before: pending.before,
    after: content,
    at: new Date().toISOString()
  });
  return {
    pending,
    patch: {
      sectionId,
      index: pending.index,
      field: pending.field,
      bulletIndex: pending.bulletIndex,
      append: pending.append,
      before: pending.before,
      after: content
    }
  };
}

// Step 2a: user confirms. Apply the pending patch to the active resume,
// then clear the slot. This is the ONLY write path for AI-proposed edits.
function commitPatch(id) {
  const { core, persistence } = createEngineCore();
  syncCoreFromDisk(core);
  const pending = persistence.loadPendingPatch();
  if (!pending) {
    throw new Error("No pending patch to commit");
  }
  if (id && pending.id !== id) {
    throw new Error(`Pending patch id mismatch: ${id} != ${pending.id}`);
  }
  core.confirmPendingPatch({ pendingId: id || pending.id });
  const resume = core.getResume();
  if (pending.kind === "batch") {
    appendActivity({
      type: "patch",
      sessionId: pending.sessionId || crypto.randomUUID(),
      pendingId: pending.id,
      kind: "batch",
      title: pending.title || "",
      sectionId: pending.changes?.[0]?.sectionId || "batch",
      at: new Date().toISOString()
    });
  } else {
    logPatch(pending.sessionId || crypto.randomUUID(), pending.sectionId, pending.before, pending.after);
  }
  return {
    resume,
    patch:
      pending.kind === "batch"
        ? { kind: "batch", title: pending.title || "", changes: pending.changes || [] }
        : {
            sectionId: pending.sectionId,
            index: pending.index,
            field: pending.field,
            before: pending.before,
            after: pending.after
          }
  };
}

// Step 2b: user rejects. Discard the pending patch, leave the resume untouched.
function rejectPatch(id) {
  const { core, persistence } = createEngineCore();
  syncCoreFromDisk(core);
  const pending = persistence.loadPendingPatch();
  if (!pending) {
    return { rejected: false };
  }
  if (id && pending.id !== id) {
    throw new Error(`Pending patch id mismatch: ${id} != ${pending.id}`);
  }
  core.rejectPendingPatch({ pendingId: id || pending.id });
  appendActivity({
    type: "rejected",
    sessionId: pending.sessionId,
    pendingId: pending.id,
    sectionId: pending.sectionId,
    at: new Date().toISOString()
  });
  return { rejected: true, pending };
}

module.exports = {
  activeResumePath,
  activityLogPath,
  activityStatePath,
  pendingPatchPath,
  materialsDir,
  extractedDir,
  appendActivity,
  clearPendingPatch,
  commitPatch,
  endCommandSession,
  loadResume,
  proposeEdit,
  readActivityEvents,
  readActivityState,
  readPendingPatch,
  rejectPatch,
  resetEngineCoreForTests,
  saveResume,
  startCommandSession,
  terminalAgentPath: path.join(workspaceDir, "resume-agent"),
  updateActivityState,
  workspaceDir,
  writePendingPatch
};
