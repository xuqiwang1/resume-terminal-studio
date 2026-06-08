const assert = require("node:assert/strict");

const { createNativeMcpRuntime } = require("./mcp-runtime.cjs");

const runtime = createNativeMcpRuntime({
  sessionManager: {
    getActiveSession() {
      return { sessionId: "session-1", resumeId: "active" };
    },
    assertWritableSession({ sessionId }) {
      if (sessionId !== "session-1") throw new Error("stale session");
    }
  },
  core: {
    getResume() {
      return { summary: "" };
    },
    proposeSectionEdit(args) {
      return { id: "pending-1", ...args };
    },
    proposeBatchEdit(args) {
      return { id: "pending-batch-1", kind: "batch", ...args };
    }
  }
});

const session = runtime.callTool("get_app_session", {});
assert.equal(session.sessionId, "session-1");

const pending = runtime.callTool("propose_section_edit", {
  sessionId: "session-1",
  sectionId: "summary",
  content: "rewritten"
});

assert.equal(pending.id, "pending-1");

const batchPending = runtime.callTool("propose_batch_edit", {
  sessionId: "session-1",
  title: "Fill education",
  changes: []
});

assert.equal(batchPending.id, "pending-batch-1");
assert.equal(batchPending.kind, "batch");
