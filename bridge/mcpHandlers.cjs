const fs = require("node:fs");
const path = require("node:path");

function textContent(value) {
  return {
    content: [
      {
        type: "text",
        text: typeof value === "string" ? value : JSON.stringify(value, null, 2)
      }
    ]
  };
}

function createMcpHandlers({
  activeResumePath,
  activeSession,
  activityLogPath,
  core,
  extractedDir,
  loadResume,
  loadSelectionState,
  materialsDir,
  readActivityEvents,
  readActivityState,
  readContextState,
  runtime,
  terminalAgentPath,
  workspaceDir,
  buildContextPayload
}) {
  function readExtractedMaterials(maxChars = 60000) {
    const limit = Math.min(Math.max(Number(maxChars) || 60000, 1000), 200000);
    let remaining = limit;
    let files = [];
    try {
      files = fs
        .readdirSync(extractedDir)
        .filter((name) => name.endsWith(".md") || name.endsWith(".txt"))
        .sort((a, b) => {
          if (a === "index.md") return -1;
          if (b === "index.md") return 1;
          return a.localeCompare(b);
        });
    } catch {
      files = [];
    }

    const materials = [];
    for (const fileName of files) {
      if (remaining <= 0) break;
      const fullPath = path.join(extractedDir, fileName);
      if (path.dirname(fullPath) !== extractedDir) continue;
      const raw = fs.readFileSync(fullPath, "utf8");
      const text = raw.slice(0, remaining);
      remaining -= text.length;
      materials.push({
        fileName,
        fullPath,
        truncated: raw.length > text.length,
        text
      });
    }

    return {
      workspaceDir,
      materialsDir,
      extractedDir,
      count: materials.length,
      maxChars: limit,
      truncated: remaining <= 0,
      hint:
        materials.length > 0
          ? "Use these materials to write finished resume copy, then submit via propose_edit for one narrow edit or propose_batch_edit for one coherent multi-field task. Do not edit active-resume.json directly. The user must accept the pending patch in the app."
          : "No extracted materials found. Ask the user to place files in workspace/materials and run `resume-agent ingest`.",
      materials
    };
  }

  function callTool(name, args = {}) {
    switch (name) {
      case "get_context":
        return textContent(buildContextPayload());
      case "get_resume":
        core.setSelection(loadSelectionState());
        return textContent({
          session: runtime.callTool("get_app_session", {}),
          workspaceDir,
          activeResumePath,
          terminalAgentPath,
          materialsDir,
          extractedDir,
          materialsHint:
            "Read your source material from the extractedDir (workspace/materials/.extracted/*.md). Run `resume-agent ingest` first if it is empty. Do NOT edit active-resume.json directly — submit one narrow edit via propose_edit, or one coherent multi-field task via propose_batch_edit, then wait for the user to accept it in the app.",
          resume: runtime.callTool("get_current_resume", {}),
          userSelection: loadSelectionState()
        });
      case "get_materials":
        return textContent(readExtractedMaterials(args.maxChars));
      case "propose_edit": {
        const pending = runtime.callTool("propose_section_edit", {
          sessionId: activeSession.sessionId,
          sectionId: args.sectionId,
          index: args.index,
          field: args.field,
          bulletIndex: args.bulletIndex,
          content: args.content
        });
        return textContent({
          status: "pending_confirmation",
          pendingId: pending.id,
          sectionId: pending.sectionId,
          index: pending.index,
          field: pending.field,
          diff: { before: pending.before, after: pending.after },
          message:
            "已生成待确认的改动草稿，尚未写入简历。请等待用户在 Resume Studio 工作台点击「接受」或「拒绝」。"
        });
      }
      case "propose_batch_edit": {
        const pending = runtime.callTool("propose_batch_edit", {
          sessionId: activeSession.sessionId,
          title: args.title,
          summary: args.summary,
          changes: args.changes
        });
        return textContent({
          status: "pending_confirmation",
          kind: pending.kind,
          pendingId: pending.id,
          title: pending.title,
          summary: pending.summary || "",
          changes: pending.changes,
          message:
            "已生成一组待确认的批量改动，尚未写入简历。请等待用户在 Resume Studio 工作台点击「接受」或「拒绝」。"
        });
      }
      case "get_pending_patch": {
        const pending = runtime.callTool("get_pending_patch", {});
        return textContent({
          pending,
          hasPending: !!pending
        });
      }
      case "get_activity":
        return textContent({
          state: readActivityState(),
          logPath: activityLogPath,
          events: readActivityEvents(args.limit || 20)
        });
      case "get_selection":
        core.setSelection(loadSelectionState());
        return textContent({
          selection: readContextState().selection || runtime.callTool("get_selection", {}),
          context: readContextState(),
          hint: "Prefer get_context for document + view + selection."
        });
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  function readResource(uri) {
    if (uri === "resume://active") {
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(
              {
                workspaceDir,
                activeResumePath,
                terminalAgentPath,
                resume: loadResume(),
                userSelection: loadSelectionState()
              },
              null,
              2
            )
          }
        ]
      };
    }

    if (uri === "resume://activity-state") {
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(readActivityState(), null, 2)
          }
        ]
      };
    }

    if (uri === "resume://activity-log") {
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(readActivityEvents(50), null, 2)
          }
        ]
      };
    }

    if (uri === "resume://context") {
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(buildContextPayload(), null, 2)
          }
        ]
      };
    }

    if (uri === "resume://materials") {
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(readExtractedMaterials(), null, 2)
          }
        ]
      };
    }

    throw new Error(`Unknown resource: ${uri}`);
  }

  return {
    callTool,
    readResource
  };
}

module.exports = {
  createMcpHandlers
};
