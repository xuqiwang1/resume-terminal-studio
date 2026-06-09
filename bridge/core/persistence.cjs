const fs = require("node:fs");
const path = require("node:path");

function createPersistence({ workspaceDir }) {
  function ensureDir() {
    fs.mkdirSync(workspaceDir, { recursive: true });
  }

  function readJson(filePath, fallback = null) {
    try {
      const raw = fs.readFileSync(filePath, "utf8");
      return raw.trim() ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(filePath, value) {
    ensureDir();
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
  }

  return {
    saveResume(resume) {
      writeJson(path.join(workspaceDir, "active-resume.json"), resume);
    },
    loadResume() {
      return readJson(path.join(workspaceDir, "active-resume.json"));
    },
    savePendingPatch(pendingPatch) {
      writeJson(path.join(workspaceDir, "pending-patch.json"), pendingPatch);
    },
    loadPendingPatch() {
      return readJson(path.join(workspaceDir, "pending-patch.json"));
    },
    clearPendingPatch() {
      ensureDir();
      fs.writeFileSync(path.join(workspaceDir, "pending-patch.json"), "");
    },
    saveSelection(selection) {
      writeJson(path.join(workspaceDir, "selection-state.json"), selection);
    },
    loadSelection() {
      return readJson(path.join(workspaceDir, "selection-state.json"), {});
    },
    saveContextState(state) {
      writeJson(path.join(workspaceDir, "context-state.json"), state || {});
    },
    loadContextState() {
      return readJson(path.join(workspaceDir, "context-state.json"), {});
    },
    saveActiveDocument(document) {
      const current = this.loadContextState() || {};
      this.saveContextState({
        ...current,
        document: {
          ...(current.document || {}),
          ...(document || {}),
          updatedAt: new Date().toISOString()
        }
      });
    },
    loadActiveDocument() {
      const state = this.loadContextState();
      return state?.document || null;
    },
    appendActivity(event) {
      ensureDir();
      fs.appendFileSync(
        path.join(workspaceDir, "activity-log.ndjson"),
        `${JSON.stringify(event)}\n`
      );
    },
    saveActivityState(state) {
      writeJson(path.join(workspaceDir, "activity-state.json"), state);
    },
    loadActivityState() {
      return readJson(path.join(workspaceDir, "activity-state.json"), {});
    },
    workspaceDir
  };
}

module.exports = { createPersistence };
