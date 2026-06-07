const crypto = require("node:crypto");

function getFieldValue(resume, sectionId, index = 0, field) {
  if (sectionId === "summary") return resume.summary || "";
  const targetField = field || "details";
  return resume?.[sectionId]?.[index]?.[targetField] || "";
}

function getPatchBefore(resume, { sectionId, index = 0, field, bulletIndex }) {
  const value = getFieldValue(resume, sectionId, index, field);
  const targetField = field || "details";
  if (targetField === "details" && typeof bulletIndex === "number" && bulletIndex >= 0) {
    return value.split("\n")[bulletIndex] || "";
  }
  return value;
}

function applyPatch(resume, patch) {
  if (patch.sectionId === "summary") {
    return { ...resume, summary: patch.after };
  }

  const targetField = patch.field || "details";
  const targetIndex = patch.index ?? 0;
  const nextItems = [...(resume[patch.sectionId] || [])];
  const current = nextItems[targetIndex];
  if (!current) return resume;
  if (targetField === "details" && typeof patch.bulletIndex === "number" && patch.bulletIndex >= 0) {
    const lines = String(current[targetField] || "").split("\n");
    if (patch.bulletIndex >= lines.length) {
      lines.push(patch.after);
    } else {
      lines[patch.bulletIndex] = patch.after;
    }
    nextItems[targetIndex] = { ...current, [targetField]: lines.join("\n") };
  } else {
    nextItems[targetIndex] = { ...current, [targetField]: patch.after };
  }
  return { ...resume, [patch.sectionId]: nextItems };
}

function createResumeCore({ bus, persistence }) {
  let resume = persistence.loadResume();
  let pendingPatch = persistence.loadPendingPatch();
  let selection = persistence.loadSelection();

  function hydrateResume(next) {
    resume = next;
    bus.emit("resume.hydrated", { resume });
  }

  function setResume(next) {
    hydrateResume(next);
    persistence.saveResume(resume);
  }

  function getResume() {
    return resume;
  }

  function getPendingPatch() {
    return pendingPatch;
  }

  function hydratePendingPatch(next) {
    pendingPatch = next || null;
    bus.emit("pending.hydrated", { pendingPatch });
  }

  function getSelection() {
    return selection;
  }

  function setSelection(next) {
    selection = next;
    persistence.saveSelection(selection);
    bus.emit("selection.changed", next);
  }

  function proposeSectionEdit({ sessionId, sectionId, content, index = 0, field, bulletIndex }) {
    const before = getPatchBefore(resume, { sectionId, index, field, bulletIndex });
    pendingPatch = {
      id: crypto.randomUUID(),
      sessionId,
      sectionId,
      index,
      field,
      bulletIndex,
      before,
      after: content
    };
    persistence.savePendingPatch(pendingPatch);
    bus.emit("pending.created", pendingPatch);
    return pendingPatch;
  }

  function confirmPendingPatch({ sessionId, pendingId }) {
    if (!pendingPatch || pendingPatch.id !== pendingId) {
      throw new Error("Invalid pending patch confirmation");
    }
    if (sessionId && pendingPatch.sessionId !== sessionId) {
      throw new Error("Invalid pending patch confirmation");
    }
    resume = applyPatch(resume, pendingPatch);
    persistence.saveResume(resume);
    persistence.clearPendingPatch();
    bus.emit("resume.updated", { sessionId, resume, patch: pendingPatch });
    pendingPatch = null;
  }

  function rejectPendingPatch({ sessionId, pendingId }) {
    if (!pendingPatch || pendingPatch.id !== pendingId) {
      throw new Error("Invalid pending patch rejection");
    }
    if (sessionId && pendingPatch.sessionId !== sessionId) {
      throw new Error("Invalid pending patch rejection");
    }
    const rejected = pendingPatch;
    persistence.clearPendingPatch();
    pendingPatch = null;
    bus.emit("pending.rejected", { sessionId, patch: rejected });
  }

  return {
    hydrateResume,
    hydratePendingPatch,
    setResume,
    getResume,
    getPendingPatch,
    getSelection,
    setSelection,
    proposeSectionEdit,
    confirmPendingPatch,
    rejectPendingPatch
  };
}

module.exports = { createResumeCore };
