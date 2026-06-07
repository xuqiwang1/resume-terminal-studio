const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const workspaceDir = process.env.WORKSPACE_DIR
  ? path.resolve(process.env.WORKSPACE_DIR)
  : path.resolve(__dirname, "../../workspace");
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

function setSummary(text, sessionId = crypto.randomUUID()) {
  const resume = loadResume();
  const before = resume.summary;
  resume.summary = text;
  saveResume(resume);
  logPatch(sessionId, "summary", before, resume.summary);
  return { resume, patch: { sectionId: "summary", before, after: resume.summary } };
}

function setTitle(text, sessionId = crypto.randomUUID()) {
  const resume = loadResume();
  const before = resume.title;
  resume.title = text;
  saveResume(resume);
  logPatch(sessionId, "title", before, resume.title);
  return { resume, patch: { sectionId: "title", before, after: resume.title } };
}

function setContact(text, sessionId = crypto.randomUUID()) {
  const resume = loadResume();
  const before = resume.contact;
  resume.contact = text;
  saveResume(resume);
  logPatch(sessionId, "contact", before, resume.contact);
  return { resume, patch: { sectionId: "contact", before, after: resume.contact } };
}

function setExperience(index, text, sessionId = crypto.randomUUID()) {
  const resume = loadResume();
  if (!resume.experience[index]) {
    throw new Error(`experience[${index}] does not exist`);
  }
  const before = resume.experience[index].details;
  resume.experience[index].details = text;
  saveResume(resume);
  logPatch(sessionId, "experience", before, resume.experience[index].details);
  return { resume, patch: { sectionId: "experience", before, after: resume.experience[index].details } };
}

function setProject(index, text, sessionId = crypto.randomUUID()) {
  const resume = loadResume();
  if (!resume.projects[index]) {
    throw new Error(`projects[${index}] does not exist`);
  }
  const before = resume.projects[index].details;
  resume.projects[index].details = text;
  saveResume(resume);
  logPatch(sessionId, "projects", before, resume.projects[index].details);
  return { resume, patch: { sectionId: "projects", before, after: resume.projects[index].details } };
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

// Empty templates for structured array sections, used when appending a new item.
function emptyTemplate(sectionId) {
  if (sectionId === "education") {
    return { school: "", degree: "", major: "", date: "", tag: "" };
  }
  if (sectionId === "skills") {
    return { category: "", content: "" };
  }
  return {};
}

// Allowed sub-fields per structured section. experience/projects keep "details".
const SECTION_FIELDS = {
  experience: ["details", "role", "company", "date"],
  projects: ["details", "name", "role", "date"],
  education: ["school", "degree", "major", "date", "tag"],
  skills: ["category", "content"]
};

const DEFAULT_FIELD = {
  experience: "details",
  projects: "details",
  education: "school",
  skills: "content"
};

// Apply a patch object onto a resume in-place-ish (returns mutated resume).
// Mirrors bridge/actions.js applyPatchToResume so commit and live actions agree.
function applyPatchToResume(resume, patch) {
  if (!patch) return resume;
  const { sectionId, after } = patch;
  if (sectionId === "summary") {
    resume.summary = after;
  } else if (sectionId === "title") {
    resume.title = after;
  } else if (sectionId === "contact") {
    resume.contact = after;
  } else if (sectionId === "experience") {
    const index = patch.index ?? 0;
    const field = patch.field || "details";
    if (resume.experience?.[index]) {
      if (typeof patch.bulletIndex === "number" && field === "details") {
        const lines = (resume.experience[index][field] || "").split("\n");
        if (patch.bulletIndex >= lines.length) {
          lines.push(after);
        } else {
          lines[patch.bulletIndex] = after;
        }
        resume.experience[index][field] = lines.join("\n");
      } else {
        resume.experience[index][field] = after;
      }
    }
  } else if (sectionId === "projects") {
    const index = patch.index ?? 0;
    const field = patch.field || "details";
    if (resume.projects?.[index]) {
      if (typeof patch.bulletIndex === "number" && field === "details") {
        const lines = (resume.projects[index][field] || "").split("\n");
        if (patch.bulletIndex >= lines.length) {
          lines.push(after);
        } else {
          lines[patch.bulletIndex] = after;
        }
        resume.projects[index][field] = lines.join("\n");
      } else {
        resume.projects[index][field] = after;
      }
    }
  } else if (sectionId === "education" || sectionId === "skills") {
    const index = patch.index ?? 0;
    const field = patch.field || DEFAULT_FIELD[sectionId];
    if (!Array.isArray(resume[sectionId])) resume[sectionId] = [];
    if (patch.append) {
      resume[sectionId].push({ ...emptyTemplate(sectionId), [field]: after });
    } else if (resume[sectionId][index]) {
      resume[sectionId][index][field] = after;
    }
  }
  return resume;
}

// Step 1: an agent proposes a finished edit. The agent (Codex/Claude) has
// already read the user's materials and WRITTEN the new text itself; the
// engine adds no "intelligence" — it only validates the target, records the
// before-value, and stores the proposal in the single pending slot.
// It does NOT write active-resume.json.
function proposeEdit({ sectionId, index = 0, field, content, bulletIndex }, sessionId = crypto.randomUUID()) {
  const allowed = ["summary", "experience", "projects", "education", "skills"];
  if (!allowed.includes(sectionId)) {
    throw new Error(
      `proposeEdit only supports ${allowed.join(", ")} (title/contact use set_title/set_contact).`
    );
  }
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("proposeEdit requires non-empty content (the finished text written by the agent).");
  }

  const resume = loadResume();
  let before;
  let resolvedField;
  let append = false;
  let resolvedBulletIndex;

  if (sectionId === "summary") {
    before = resume.summary;
  } else {
    // Resolve and validate the target sub-field for this section.
    resolvedField = field || DEFAULT_FIELD[sectionId];
    const allowedFields = SECTION_FIELDS[sectionId];
    if (!allowedFields.includes(resolvedField)) {
      throw new Error(
        `${sectionId} only allows fields: ${allowedFields.join(", ")} (got "${resolvedField}").`
      );
    }

    const arr = resume[sectionId];
    if (Array.isArray(arr) && arr.length === 0 && index === 0) {
      // Append semantics: proposing onto an empty array stages a brand-new item.
      append = true;
      before = "";
    } else if (Array.isArray(arr) && arr[index]) {
      const fullValue = arr[index][resolvedField] || "";
      // Bullet-level editing: if bulletIndex is specified and field is text-like,
      // extract only that bullet (line) as "before", so the diff is precise.
      if (typeof bulletIndex === "number" && bulletIndex >= 0 && resolvedField === "details") {
        const lines = fullValue.split("\n");
        if (bulletIndex >= lines.length) {
          // Appending a new bullet at the end
          before = "";
          resolvedBulletIndex = bulletIndex;
        } else {
          before = lines[bulletIndex];
          resolvedBulletIndex = bulletIndex;
        }
      } else {
        before = fullValue;
      }
    } else {
      throw new Error(`${sectionId}[${index}] does not exist`);
    }
  }

  const pending = {
    id: crypto.randomUUID(),
    sessionId,
    sectionId,
    index: sectionId === "summary" ? undefined : index,
    field: resolvedField,
    bulletIndex: resolvedBulletIndex,
    append: append || undefined,
    before,
    after: content,
    status: "pending",
    createdAt: new Date().toISOString()
  };
  writePendingPatch(pending);
  appendActivity({
    type: "proposed",
    sessionId,
    pendingId: pending.id,
    sectionId,
    before,
    after: content,
    at: new Date().toISOString()
  });
  return { pending, patch: { sectionId, index: pending.index, field: resolvedField, bulletIndex: resolvedBulletIndex, append: pending.append, before, after: content } };
}

// Step 2a: user confirms. Apply the pending patch to the active resume,
// then clear the slot. This is the ONLY write path for AI-proposed edits.
function commitPatch(id) {
  const pending = readPendingPatch();
  if (!pending) {
    throw new Error("No pending patch to commit");
  }
  if (id && pending.id !== id) {
    throw new Error(`Pending patch id mismatch: ${id} != ${pending.id}`);
  }
  const resume = loadResume();
  const before = pending.before;
  applyPatchToResume(resume, pending);
  saveResume(resume);
  logPatch(pending.sessionId || crypto.randomUUID(), pending.sectionId, before, pending.after);
  clearPendingPatch();
  return {
    resume,
    patch: {
      sectionId: pending.sectionId,
      index: pending.index,
      field: pending.field,
      before,
      after: pending.after
    }
  };
}

// Step 2b: user rejects. Discard the pending patch, leave the resume untouched.
function rejectPatch(id) {
  const pending = readPendingPatch();
  if (!pending) {
    return { rejected: false };
  }
  if (id && pending.id !== id) {
    throw new Error(`Pending patch id mismatch: ${id} != ${pending.id}`);
  }
  clearPendingPatch();
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
  applyPatchToResume,
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
  setContact,
  setExperience,
  setProject,
  setSummary,
  setTitle,
  startCommandSession,
  terminalAgentPath: path.join(workspaceDir, "resume-agent"),
  updateActivityState,
  workspaceDir
};
