const { createAppSessionManager } = require("./appSession.cjs");
const { createEventBus } = require("./eventBus.cjs");
const { createPersistence } = require("./persistence.cjs");
const { createResumeCore } = require("./resumeCore.cjs");

let singleton = null;

function initializeRuntime({ workspaceDir, resume, resumeId = "active" }) {
  if (singleton) return singleton;

  const sessionManager = createAppSessionManager();
  const activeSession = sessionManager.startSession({ resumeId });
  const bus = createEventBus();
  const persistence = createPersistence({ workspaceDir });
  const core = createResumeCore({ bus, persistence });

  if (!core.getResume()) {
    core.setResume(resume);
  }

  singleton = {
    activeSession,
    bus,
    core,
    persistence,
    sessionManager
  };

  return singleton;
}

function getRuntime() {
  if (!singleton) {
    throw new Error("Runtime not initialized");
  }
  return singleton;
}

module.exports = {
  getRuntime,
  initializeRuntime
};
