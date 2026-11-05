const crypto = require("node:crypto");

const SECTION_FIELDS = {
  education: ["school", "degree", "major", "date", "tag"],
  skills: ["category", "content"],
  experience: ["company", "role", "date", "details"],
  projects: ["name", "role", "date", "details"]
};

const DEFAULT_FIELD = {
  education: "school",
  skills: "content",
  experience: "details",
  projects: "details"
};

const SCALAR_SECTIONS = ["name", "summary", "title", "contact"];

function cloneResume(resume) {
  return JSON.parse(JSON.stringify(resume || {}));
}

function normalizeEvidence(evidence) {
  if (!Array.isArray(evidence)) return [];
  return evidence
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => ({
      sourcePath: String(item.sourcePath || "").trim(),
      label: String(item.label || "").trim(),
      quote: item.quote ? String(item.quote).trim() : ""
    }))
    .filter((item) => item.sourcePath && item.label);
}

function classifyBatchRisk(changes) {
  if (!Array.isArray(changes) || changes.length === 0) return "low";
  const hasWholeItemChange = changes.some((change) => {
    if (!change || typeof change !== "object") return false;
    if (change.operation === "replace_item" || change.operation === "append_item") return true;
    return change.operation === "replace_section" && !SCALAR_SECTIONS.includes(change.sectionId);
  });
  if (hasWholeItemChange) return "high";
  if (changes.length > 1) return "medium";
  return "low";
}

function getFieldValue(resume, sectionId, index = 0, field) {
  if (sectionId === "name" || sectionId === "summary" || sectionId === "title" || sectionId === "contact") {
    return resume?.[sectionId] ?? "";
  }
  const targetField = field || DEFAULT_FIELD[sectionId] || "details";
  return resume?.[sectionId]?.[index]?.[targetField] ?? "";
}

function getPatchBefore(resume, { sectionId, index = 0, field, bulletIndex }) {
  const value = getFieldValue(resume, sectionId, index, field);
  const targetField = field || DEFAULT_FIELD[sectionId] || "details";
  if (targetField === "details" && typeof bulletIndex === "number" && bulletIndex >= 0) {
    // A styled field holds rich-text segments rather than a string; there are no
    // bullet lines to index into, so report the whole value instead of throwing.
    if (typeof value !== "string") return value;
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

function validateSinglePatchInput(resume, { sectionId, index = 0, field, content, bulletIndex }) {
  const allowed = ["name", "title", "contact", "summary", "experience", "projects", "education", "skills"];
  if (!allowed.includes(sectionId)) {
    throw new Error(`proposeEdit only supports ${allowed.join(", ")}.`);
  }
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("proposeEdit requires non-empty content (the finished text written by the agent).");
  }

  if (sectionId === "name" || sectionId === "title" || sectionId === "contact" || sectionId === "summary") {
    return {
      field: undefined,
      before: resume?.[sectionId] || "",
      bulletIndex: undefined,
      append: undefined
    };
  }

  const targetField = field || DEFAULT_FIELD[sectionId] || "details";
  validateStructuredField(sectionId, targetField);
  const arr = resume?.[sectionId];
  if (Array.isArray(arr) && arr.length === 0 && index === 0) {
    return {
      field: targetField,
      before: "",
      bulletIndex: undefined,
      append: true
    };
  }

  const current = validateExistingItem(resume, sectionId, index);
  const fullValue = current[targetField] || "";
  if (typeof bulletIndex === "number" && bulletIndex >= 0 && targetField === "details") {
    const lines = fullValue.split("\n");
    if (bulletIndex >= lines.length) {
      return {
        field: targetField,
        before: "",
        bulletIndex,
        append: undefined
      };
    }
    return {
      field: targetField,
      before: lines[bulletIndex],
      bulletIndex,
      append: undefined
    };
  }

  return {
    field: targetField,
    before: fullValue,
    bulletIndex: undefined,
    append: undefined
  };
}

function applySinglePatch(resume, patch) {
  if (SCALAR_SECTIONS.includes(patch.sectionId)) {
    return { ...resume, [patch.sectionId]: patch.after };
  }

  const targetField = patch.field || "details";
  const targetIndex = patch.index ?? 0;
  const nextItems = [...(resume[patch.sectionId] || [])];
  if (patch.append) {
    return {
      ...resume,
      [patch.sectionId]: [...nextItems, { [targetField]: patch.after }]
    };
  }
  const current = nextItems[targetIndex];
  // Returning the resume unchanged here used to report success while applying
  // nothing: the pending slot was cleared and the user was told their edit landed.
  if (!current) {
    throw new Error(
      `${patch.sectionId}[${targetIndex}] no longer exists; the patch cannot be applied`
    );
  }
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

// Targets are validated when the patch is proposed, but a patch sits on disk
// between propose and accept and the resume can shrink in the meantime. Spreading
// a missing item would produce `{...undefined}` — a phantom entry holding only the
// patched field — so the index is re-checked at apply time.
function requireExistingItems(resume, change) {
  const items = resume[change.sectionId];
  if (!Array.isArray(items) || !items[change.index]) {
    throw new Error(
      `${change.sectionId}[${change.index}] no longer exists; the patch cannot be applied`
    );
  }
  return [...items];
}

function applyNormalizedBatchChange(resume, change) {
  if ((change.operation === "replace_section" || change.operation === "replace_field") && SCALAR_SECTIONS.includes(change.sectionId)) {
    return { ...resume, [change.sectionId]: change.after };
  }

  if (change.operation === "replace_section" || change.operation === "replace_field") {
    const nextItems = requireExistingItems(resume, change);
    nextItems[change.index] = { ...nextItems[change.index], [change.field]: change.after };
    return { ...resume, [change.sectionId]: nextItems };
  }

  if (change.operation === "replace_item") {
    const nextItems = requireExistingItems(resume, change);
    nextItems[change.index] = change.after;
    return { ...resume, [change.sectionId]: nextItems };
  }

  if (change.operation === "append_item") {
    return { ...resume, [change.sectionId]: [...(resume[change.sectionId] || []), change.after] };
  }

  throw new Error(`Unsupported batch operation "${change.operation}"`);
}

// Fails closed. Requiring both revisions to be integers before comparing them
// meant a patch missing its revision — written by an older build, or hand-edited —
// was treated as never stale and could be applied to a document it was never
// proposed against. A patch we cannot prove is current is stale.
function isPendingStaleForActiveDocument(pendingPatch, activeDocument) {
  if (!pendingPatch || !activeDocument) return false;
  if (
    activeDocument.documentId &&
    pendingPatch.documentId &&
    activeDocument.documentId !== pendingPatch.documentId
  ) {
    return true;
  }
  if (!Number.isInteger(activeDocument.revision) || !Number.isInteger(pendingPatch.revision)) {
    return true;
  }
  return activeDocument.revision !== pendingPatch.revision;
}

function isActiveDocumentBound(activeDocument) {
  return Boolean(
    activeDocument?.documentId &&
      activeDocument?.activeResumePath &&
      Number.isInteger(activeDocument.revision)
  );
}

function normalizeBatchChange(resume, change) {
  if (!change || typeof change !== "object") {
    throw new Error("Batch change must be an object");
  }

  const { operation, sectionId } = change;
  if (!operation) throw new Error("Batch change requires operation");
  if (!sectionId) throw new Error("Batch change requires sectionId");

  if (operation === "replace_section") {
    if (SCALAR_SECTIONS.includes(sectionId)) {
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
    if (SCALAR_SECTIONS.includes(sectionId)) {
      if (typeof change.value !== "string") {
        throw new Error(`${sectionId} replace_field requires string value`);
      }
      if ("index" in change && change.index != null) {
        throw new Error(`${sectionId} replace_field does not accept index`);
      }
      return {
        operation,
        sectionId,
        before: resume?.[sectionId] || "",
        after: change.value
      };
    }
    if (typeof change.field !== "string" || !change.field) {
      throw new Error(`${sectionId} replace_field requires field`);
    }
    if (typeof change.index !== "number") {
      throw new Error(`${sectionId} replace_field requires index`);
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

// A pending patch records the value it expects to replace. If that value no longer
// matches the resume — the user restyled the field, an agent rewrote the file, a
// history version was restored — then applying the patch would silently discard
// whatever replaced it. We report the mismatch instead of overwriting.
function currentValueForChange(resume, change) {
  if (change.operation === "replace_item") {
    return resume?.[change.sectionId]?.[change.index] ?? null;
  }
  return getFieldValue(resume, change.sectionId, change.index ?? 0, change.field);
}

function sameRecordedValue(expected, actual) {
  if (typeof expected === "string" || typeof actual === "string") {
    return (expected || "") === (actual || "");
  }
  return JSON.stringify(expected ?? null) === JSON.stringify(actual ?? null);
}

function conflictEntry(target, expected, actual) {
  return {
    sectionId: target.sectionId,
    index: typeof target.index === "number" ? target.index : null,
    field: target.field || null,
    bulletIndex: typeof target.bulletIndex === "number" ? target.bulletIndex : null,
    expected: expected ?? null,
    actual: actual ?? null
  };
}

function detectPendingConflicts(pendingPatch, resume) {
  if (!pendingPatch) return [];

  if (pendingPatch.kind === "batch") {
    // append_item records `before: null` because it targets an item that does not
    // exist yet — there is nothing it could conflict with.
    return (pendingPatch.changes || [])
      .filter((change) => change.operation !== "append_item")
      .reduce((conflicts, change) => {
        const actual = currentValueForChange(resume, change);
        if (!sameRecordedValue(change.before, actual)) {
          conflicts.push(conflictEntry(change, change.before, actual));
        }
        return conflicts;
      }, []);
  }

  if (pendingPatch.append) return [];
  const actual = getPatchBefore(resume, pendingPatch);
  if (sameRecordedValue(pendingPatch.before, actual)) return [];
  return [conflictEntry(pendingPatch, pendingPatch.before, actual)];
}

function describePendingSlot(pendingPatch) {
  if (pendingPatch.kind === "batch") {
    return `batch "${pendingPatch.title || "untitled"}" (${(pendingPatch.changes || []).length} changes)`;
  }
  return `${pendingPatch.sectionId}${
    typeof pendingPatch.index === "number" ? `[${pendingPatch.index}]` : ""
  }`;
}

// There is exactly one pending slot and the workbench shows exactly one banner,
// so a second proposal used to overwrite the first with no error: the user never
// learned that a suggestion they were about to review had been discarded. The
// write is now refused unless the caller says it means to replace.
function assertPendingSlotFree(pendingPatch, replace) {
  if (!pendingPatch || replace) return;
  const error = new Error(
    `A pending patch is already awaiting review (${describePendingSlot(pendingPatch)}, id ${pendingPatch.id}). ` +
      "Ask the user to accept or reject it, or re-send with replace=true to discard it."
  );
  error.name = "PendingPatchExists";
  error.pendingId = pendingPatch.id;
  throw error;
}

function createResumeCore({ bus, persistence }) {
  let resume = persistence.loadResume();
  let pendingPatch = persistence.loadPendingPatch();
  let selection = persistence.loadSelection();
  let activeDocument = persistence.loadActiveDocument?.() || null;

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

  function hydrateActiveDocument(next) {
    activeDocument = next || null;
    if (persistence.saveActiveDocument && activeDocument) {
      persistence.saveActiveDocument(activeDocument);
    }
    let clearedPendingPatch = false;
    if (isPendingStaleForActiveDocument(pendingPatch, activeDocument)) {
      // Dropping a stale patch is a cleanup, not the caller's operation. A failed
      // write here must not take the document binding down with it.
      try {
        persistence.clearPendingPatch();
      } catch (error) {
        bus.emit("pending.clearFailed", { patch: pendingPatch, error });
      }
      pendingPatch = null;
      clearedPendingPatch = true;
      bus.emit("pending.cleared", { reason: "stale-document", activeDocument });
    }
    bus.emit("document.hydrated", { activeDocument });
    return { activeDocument, clearedPendingPatch };
  }

  function getActiveDocument() {
    return activeDocument;
  }

  function getSelection() {
    return selection;
  }

  function setSelection(next) {
    selection = next;
    persistence.saveSelection(selection);
    bus.emit("selection.changed", next);
  }

  function proposeSectionEdit({ sessionId, sectionId, content, index = 0, field, bulletIndex, evidence, replace = false }) {
    if (!isActiveDocumentBound(activeDocument)) {
      throw new Error("Active document context is required before proposing edits");
    }
    assertPendingSlotFree(pendingPatch, replace);
    const normalized = validateSinglePatchInput(resume, {
      sectionId,
      index,
      field,
      content,
      bulletIndex
    });
    pendingPatch = {
      id: crypto.randomUUID(),
      kind: "single",
      sessionId,
      documentId: activeDocument?.documentId,
      revision: activeDocument?.revision,
      activeResumePath: activeDocument?.activeResumePath,
      sectionId,
      index: ["name", "title", "contact", "summary"].includes(sectionId) ? undefined : index,
      field: normalized.field,
      bulletIndex: normalized.bulletIndex,
      append: normalized.append,
      before: normalized.before,
      after: content,
      riskLevel: "low",
      evidence: normalizeEvidence(evidence)
    };
    persistence.savePendingPatch(pendingPatch);
    bus.emit("pending.created", pendingPatch);
    return pendingPatch;
  }

  function proposeBatchEdit({ sessionId, title, summary = "", changes, evidence, allowHighRisk = false, replace = false }) {
    if (!isActiveDocumentBound(activeDocument)) {
      throw new Error("Active document context is required before proposing edits");
    }
    assertPendingSlotFree(pendingPatch, replace);
    if (typeof title !== "string" || !title.trim()) {
      throw new Error("Batch edit requires title");
    }
    if (!Array.isArray(changes) || changes.length === 0) {
      throw new Error("Batch edit requires at least one change");
    }
    const riskLevel = classifyBatchRisk(changes);
    if (riskLevel === "high" && !allowHighRisk) {
      throw new Error("High-risk patch requires allowHighRisk=true because it can replace whole structured resume items");
    }
    const normalizedChanges = changes.map((change) => normalizeBatchChange(resume, change));
    pendingPatch = {
      id: crypto.randomUUID(),
      kind: "batch",
      sessionId,
      documentId: activeDocument?.documentId,
      revision: activeDocument?.revision,
      activeResumePath: activeDocument?.activeResumePath,
      title,
      summary,
      riskLevel,
      changes: normalizedChanges,
      evidence: normalizeEvidence(evidence)
    };
    persistence.savePendingPatch(pendingPatch);
    bus.emit("pending.created", pendingPatch);
    return pendingPatch;
  }

  function confirmPendingPatch({ sessionId, pendingId, allowConflict = false }) {
    if (!pendingPatch || pendingPatch.id !== pendingId) {
      throw new Error("Invalid pending patch confirmation");
    }
    if (sessionId && pendingPatch.sessionId !== sessionId) {
      throw new Error("Invalid pending patch confirmation");
    }
    if (isPendingStaleForActiveDocument(pendingPatch, activeDocument)) {
      throw new Error("Stale pending patch: active document changed");
    }
    const conflicts = detectPendingConflicts(pendingPatch, resume);
    if (conflicts.length && !allowConflict) {
      const error = new Error("Conflicting pending patch: the target text changed after this patch was proposed");
      error.name = "PendingPatchConflict";
      error.conflicts = conflicts;
      throw error;
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

    // Disk first, memory second. The old order advanced the in-memory resume
    // before saving, so a failed write left the runtime claiming an edit that was
    // not on disk and the pending slot already consumed. If saveResume throws now,
    // nothing has moved and the patch is still reviewable.
    const appliedPatch = pendingPatch;
    persistence.saveResume(nextResume);
    resume = nextResume;

    // The patch is applied and durable at this point. If clearing the slot fails,
    // the content is still correct; the stale pending file will be re-offered on
    // restart and its recorded `before` no longer matches, so it surfaces as a
    // conflict rather than applying twice.
    let clearError = null;
    try {
      persistence.clearPendingPatch();
    } catch (error) {
      clearError = error;
    }
    pendingPatch = null;
    bus.emit("resume.updated", { sessionId, resume, patch: appliedPatch });
    if (clearError) {
      bus.emit("pending.clearFailed", { patch: appliedPatch, error: clearError });
    }
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
    hydrateActiveDocument,
    setResume,
    getResume,
    getPendingPatch,
    getPendingConflicts: () => detectPendingConflicts(pendingPatch, resume),
    getActiveDocument,
    getSelection,
    setSelection,
    proposeSectionEdit,
    proposeBatchEdit,
    confirmPendingPatch,
    rejectPendingPatch
  };
}

module.exports = {
  createResumeCore,
  detectPendingConflicts,
  isPendingStaleForActiveDocument
};
