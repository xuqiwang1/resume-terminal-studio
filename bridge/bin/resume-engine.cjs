const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { createEventBus } = require("../core/eventBus.cjs");
const { createPersistence } = require("../core/persistence.cjs");
const { createResumeCore } = require("../core/resumeCore.cjs");
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
  fs.writeFileSync(activeResumePath, JSON.stringify(resume, null, 2));
}

function readActivityState() {
  try {
    const raw = fs.readFileSync(activityStatePath, "utf8");
    return raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function readActivityEvents(limit = 20) {
  try {
    const raw = fs.readFileSync(activityLogPath, "utf8");
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(-limit)
      .map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

function updateActivityState(patch) {
  const current = readActivityState();
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
  fs.writeFileSync(activityStatePath, JSON.stringify(next, null, 2));
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
  try {
    const raw = fs.readFileSync(pendingPatchPath, "utf8");
    return raw.trim() ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writePendingPatch(pending) {
  fs.writeFileSync(pendingPatchPath, JSON.stringify(pending, null, 2));
}

function clearPendingPatch() {
  try {
    fs.writeFileSync(pendingPatchPath, "");
  } catch {
    // ignore
  }
}

function createEngineCore() {
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
  return { core, persistence };
}

// Step 1: an agent proposes a finished edit. The agent (Codex/Claude) has
// already read the user's materials and WRITTEN the new text itself; the
// engine adds no "intelligence" — it only validates the target, records the
// before-value, and stores the proposal in the single pending slot.
// It does NOT write active-resume.json.
function proposeEdit({ sectionId, index = 0, field, content, bulletIndex }, sessionId = crypto.randomUUID()) {
  const { core } = createEngineCore();
  const pending = core.proposeSectionEdit({
    sessionId,
    sectionId,
    index,
    field,
    bulletIndex,
    content
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
  const pending = persistence.loadPendingPatch();
  if (!pending) {
    throw new Error("No pending patch to commit");
  }
  if (id && pending.id !== id) {
    throw new Error(`Pending patch id mismatch: ${id} != ${pending.id}`);
  }
  core.confirmPendingPatch({ pendingId: id });
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
  const pending = persistence.loadPendingPatch();
  if (!pending) {
    return { rejected: false };
  }
  if (id && pending.id !== id) {
    throw new Error(`Pending patch id mismatch: ${id} != ${pending.id}`);
  }
  core.rejectPendingPatch({ pendingId: id });
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
  saveResume,
  startCommandSession,
  terminalAgentPath: path.join(workspaceDir, "resume-agent"),
  updateActivityState,
  workspaceDir
};
