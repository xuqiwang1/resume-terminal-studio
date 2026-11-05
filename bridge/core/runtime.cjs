const path = require("node:path");
const { createAppSessionManager } = require("./appSession.cjs");
const { createEventBus } = require("./eventBus.cjs");
const { createPersistence } = require("./persistence.cjs");
const { createResumeCore } = require("./resumeCore.cjs");

let singleton = null;

// The runtime is a process-wide singleton because the HTTP server, the MCP
// server, and the CLI engine must all see the same pending slot. Returning the
// existing instance for a *different* workspace, however, silently pointed the
// caller at another directory's resume. Mismatches are now refused out loud.
function initializeRuntime({ workspaceDir, resume, resumeId = "active" }) {
  if (!workspaceDir) {
    throw new Error("initializeRuntime requires workspaceDir");
  }
  const resolvedWorkspaceDir = path.resolve(workspaceDir);

  if (singleton) {
    if (singleton.workspaceDir !== resolvedWorkspaceDir) {
      throw new Error(
        `Runtime already initialized for workspace ${singleton.workspaceDir}; ` +
          `refusing to rebind to ${resolvedWorkspaceDir}`
      );
    }
    return singleton;
  }

  const sessionManager = createAppSessionManager();
  const activeSession = sessionManager.startSession({ resumeId });
  const bus = createEventBus();
  const persistence = createPersistence({ workspaceDir: resolvedWorkspaceDir });
  const core = createResumeCore({ bus, persistence });

  if (!core.getResume()) {
    core.setResume(resume);
  }

  singleton = {
    activeSession,
    bus,
    core,
    persistence,
    sessionManager,
    workspaceDir: resolvedWorkspaceDir
  };

  return singleton;
}

function getRuntime() {
  if (!singleton) {
    throw new Error("Runtime not initialized");
  }
  return singleton;
}

// Tests spin up throwaway workspaces in one process; without this they would
// either leak state between cases or have to fork a child per case.
function resetRuntimeForTests() {
  singleton = null;
}

module.exports = {
  getRuntime,
  initializeRuntime,
  resetRuntimeForTests
};
