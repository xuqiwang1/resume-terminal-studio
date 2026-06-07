const crypto = require("node:crypto");

function createAppSessionManager() {
  let activeSession = null;

  return {
    startSession({ resumeId }) {
      activeSession = {
        sessionId: crypto.randomUUID(),
        resumeId,
        startedAt: new Date().toISOString()
      };
      return activeSession;
    },
    getActiveSession() {
      return activeSession;
    },
    assertWritableSession({ sessionId }) {
      if (!activeSession || activeSession.sessionId !== sessionId) {
        throw new Error("stale session cannot write");
      }
      return activeSession;
    }
  };
}

module.exports = { createAppSessionManager };
