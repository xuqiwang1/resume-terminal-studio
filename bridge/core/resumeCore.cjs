const crypto = require("node:crypto");

const SECTION_FIELDS = {
  education: ["school", "degree", "major", "date", "tag"],
  skills: ["category", "content"],
  experience: ["company", "role", "date", "details"],
  projects: ["name", "role", "date", "details"]
};

function cloneResume(resume) {
  return JSON.parse(JSON.stringify(resume || {}));
}

function getFieldValue(resume, sectionId, index = 0, field) {
  if (sectionId === "summary" || sectionId === "title" || sectionId === "contact") {
    return resume?.[sectionId] || "";
  }
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

function validateStructuredField(sectionId, field) {
  const allowed = SECTION_FIELDS[sectionId];
  if (!allowed) {
    throw new Error(`Unsupported sectionId "${sectionId}"`);
  }
  if (!allowed.includes(field)) {
    throw new Error(
      `${sectionId} field "${field}" is invalid; expected one of ${allowed.join(", ")}`
    );
  }
}

function validateExistingItem(resume, sectionId, index) {
  const arr = resume?.[sectionId];
  if (!Array.isArray(arr) || !arr[index]) {
    throw new Error(`${sectionId}[${index}] does not exist; use append_item instead`);
  }
  return arr[index];
}

function applySinglePatch(resume, patch) {
  if (patch.sectionId === "summary" || patch.sectionId === "title" || patch.sectionId === "contact") {
    return { ...resume, [patch.sectionId]: patch.after };
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

function applyNormalizedBatchChange(resume, change) {
  if (change.operation === "replace_section" && ["summary", "title", "contact"].includes(change.sectionId)) {
    return { ...resume, [change.sectionId]: change.after };
  }

  if (change.operation === "replace_section") {
    const nextItems = [...(resume[change.sectionId] || [])];
    nextItems[change.index] = { ...nextItems[change.index], [change.field]: change.after };
    return { ...resume, [change.sectionId]: nextItems };
  }

  if (change.operation === "replace_field") {
    const nextItems = [...(resume[change.sectionId] || [])];
    nextItems[change.index] = { ...nextItems[change.index], [change.field]: change.after };
    return { ...resume, [change.sectionId]: nextItems };
  }

  if (change.operation === "replace_item") {
    const nextItems = [...(resume[change.sectionId] || [])];
    nextItems[change.index] = change.after;
    return { ...resume, [change.sectionId]: nextItems };
  }

  if (change.operation === "append_item") {
    return { ...resume, [change.sectionId]: [...(resume[change.sectionId] || []), change.after] };
  }

  throw new Error(`Unsupported batch operation "${change.operation}"`);
}

function normalizeBatchChange(resume, change) {
  if (!change || typeof change !== "object") {
    throw new Error("Batch change must be an object");
  }

  const { operation, sectionId } = change;
  if (!operation) throw new Error("Batch change requires operation");
  if (!sectionId) throw new Error("Batch change requires sectionId");

  if (operation === "replace_section") {
    if (["summary", "title", "contact"].includes(sectionId)) {
      if (typeof change.value !== "string") {
        throw new Error(`${sectionId} replace_section requires string value`);
      }
      return {
        operation,
        sectionId,
        before: resume?.[sectionId] || "",
        after: change.value
      };
    }

    if (typeof change.index !== "number" || typeof change.field !== "string") {
      throw new Error(`${sectionId} replace_section requires index and field`);
    }
    validateStructuredField(sectionId, change.field);
    const current = validateExistingItem(resume, sectionId, change.index);
    if (typeof change.value !== "string") {
      throw new Error(`${sectionId}[${change.index}].${change.field} replace_section requires string value`);
    }
    return {
      operation,
      sectionId,
      index: change.index,
      field: change.field,
      before: current[change.field] || "",
      after: change.value
    };
  }

  if (operation === "replace_field") {
    if (typeof change.index !== "number" || typeof change.field !== "string") {
      throw new Error(`${sectionId} replace_field requires index and field`);
    }
    validateStructuredField(sectionId, change.field);
    const current = validateExistingItem(resume, sectionId, change.index);
    return {
      operation,
      sectionId,
      index: change.index,
      field: change.field,
      before: current[change.field] || "",
      after: change.value
    };
  }

  if (operation === "replace_item") {
    if (typeof change.index !== "number") {
      throw new Error(`${sectionId} replace_item requires index`);
    }
    if (!change.value || typeof change.value !== "object" || Array.isArray(change.value)) {
      throw new Error(`${sectionId} replace_item requires object value`);
    }
    validateExistingItem(resume, sectionId, change.index);
    return {
      operation,
      sectionId,
      index: change.index,
      before: cloneResume(resume[sectionId][change.index]),
      after: cloneResume(change.value)
    };
  }

  if (operation === "append_item") {
    if ("index" in change && change.index != null) {
      throw new Error(`${sectionId} append_item does not accept index`);
    }
    if (!change.value || typeof change.value !== "object" || Array.isArray(change.value)) {
      throw new Error(`${sectionId} append_item requires object value`);
    }
    if (!SECTION_FIELDS[sectionId]) {
      throw new Error(`${sectionId} does not support append_item`);
    }
    return {
      operation,
      sectionId,
      before: null,
      after: cloneResume(change.value)
    };
  }

  throw new Error(`Unsupported batch operation "${operation}"`);
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
      kind: "single",
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

  function proposeBatchEdit({ sessionId, title, summary = "", changes }) {
    if (typeof title !== "string" || !title.trim()) {
      throw new Error("Batch edit requires title");
    }
    if (!Array.isArray(changes) || changes.length === 0) {
      throw new Error("Batch edit requires at least one change");
    }
    const normalizedChanges = changes.map((change) => normalizeBatchChange(resume, change));
    pendingPatch = {
      id: crypto.randomUUID(),
      kind: "batch",
      sessionId,
      title,
      summary,
      changes: normalizedChanges
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
    let nextResume = resume;
    if (pendingPatch.kind === "batch") {
      nextResume = pendingPatch.changes.reduce(
        (acc, change) => applyNormalizedBatchChange(acc, change),
        cloneResume(resume)
      );
    } else {
      nextResume = applySinglePatch(resume, pendingPatch);
    }
    resume = nextResume;
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
    proposeBatchEdit,
    confirmPendingPatch,
    rejectPendingPatch
  };
}

module.exports = { createResumeCore };
