const fs = require("node:fs");
const path = require("node:path");
const { readJsonSync, writeFileAtomicSync, writeJsonAtomicSync } = require("./atomicFile.cjs");

function createPersistence({ workspaceDir, onCorruption } = {}) {
  const corruptionEvents = [];

  function ensureDir() {
    fs.mkdirSync(workspaceDir, { recursive: true });
  }

  function filePath(name) {
    return path.join(workspaceDir, name);
  }

  // Corruption is surfaced rather than swallowed: the bytes are moved aside for
  // recovery and the event is recorded so a caller (or a test) can see that the
  // fallback it just received is a damaged file, not an absent one.
  function reportCorruption(event) {
    corruptionEvents.push({ ...event, at: new Date().toISOString() });
    if (typeof onCorruption === "function") {
      try {
        onCorruption(event);
      } catch {
        // A reporting hook must never break a read.
      }
    }
  }

  function readJson(name, { fallback = null, quarantine = false } = {}) {
    const result = readJsonSync(filePath(name), { fallback, quarantine, label: name });
    if (result.corrupt) {
      reportCorruption({
        file: name,
        path: filePath(name),
        quarantinePath: result.quarantinePath || null,
        reason: result.reason
      });
    }
    return result.value;
  }

  function writeJson(name, value) {
    ensureDir();
    writeJsonAtomicSync(filePath(name), value);
  }

  function loadContextState() {
    return readJson("context-state.json", { fallback: {}, quarantine: true });
  }

  function saveContextState(state) {
    writeJson("context-state.json", state || {});
  }

  return {
    saveResume(resume) {
      writeJson("active-resume.json", resume);
    },
    loadResume() {
      // The resume is the asset worth protecting: a damaged file is quarantined so
      // the next save cannot overwrite it with a blank document.
      return readJson("active-resume.json", { fallback: null, quarantine: true });
    },
    savePendingPatch(pendingPatch) {
      writeJson("pending-patch.json", pendingPatch);
    },
    loadPendingPatch() {
      return readJson("pending-patch.json", { fallback: null, quarantine: true });
    },
    clearPendingPatch() {
      ensureDir();
      writeFileAtomicSync(filePath("pending-patch.json"), "");
    },
    saveSelection(selection) {
      writeJson("selection-state.json", selection);
    },
    loadSelection() {
      return readJson("selection-state.json", { fallback: {} });
    },
    saveContextState,
    loadContextState,
    saveActiveDocument(document) {
      const current = loadContextState() || {};
      saveContextState({
        ...current,
        document: {
          ...(current.document || {}),
          ...(document || {}),
          updatedAt: new Date().toISOString()
        }
      });
    },
    loadActiveDocument() {
      const state = loadContextState();
      return state?.document || null;
    },
    appendActivity(event) {
      ensureDir();
      // Append-only log: a partial line here costs one event, and rewriting the
      // whole file atomically would cost O(size) on every append.
      fs.appendFileSync(filePath("activity-log.ndjson"), `${JSON.stringify(event)}\n`);
    },
    saveActivityState(state) {
      writeJson("activity-state.json", state);
    },
    loadActivityState() {
      return readJson("activity-state.json", { fallback: {} });
    },
    getCorruptionEvents() {
      return [...corruptionEvents];
    },
    workspaceDir
  };
}

module.exports = { createPersistence };
