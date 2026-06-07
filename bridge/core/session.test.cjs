const assert = require("node:assert/strict");

const { createAppSessionManager } = require("./appSession.cjs");

const sessions = createAppSessionManager();
const first = sessions.startSession({ resumeId: "active" });

assert.equal(sessions.getActiveSession().sessionId, first.sessionId);
assert.throws(
  () => sessions.assertWritableSession({ sessionId: "stale-session" }),
  /stale/i
);
