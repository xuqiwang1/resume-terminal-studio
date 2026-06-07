function createNativeMcpRuntime({ sessionManager, core }) {
  return {
    callTool(name, args = {}) {
      if (name === "get_app_session") {
        return sessionManager.getActiveSession();
      }
      if (name === "get_current_resume") {
        return core.getResume();
      }
      if (name === "get_pending_patch") {
        return core.getPendingPatch();
      }
      if (name === "get_selection") {
        return core.getSelection();
      }
      if (name === "propose_section_edit") {
        sessionManager.assertWritableSession({ sessionId: args.sessionId });
        return core.proposeSectionEdit(args);
      }
      if (name === "confirm_pending_patch") {
        sessionManager.assertWritableSession({ sessionId: args.sessionId });
        return core.confirmPendingPatch(args);
      }
      throw new Error(`Unknown tool: ${name}`);
    }
  };
}

module.exports = { createNativeMcpRuntime };
