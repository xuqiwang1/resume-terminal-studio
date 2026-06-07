#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { initializeRuntime } = require("./core/runtime.cjs");
const { createNativeMcpRuntime } = require("./mcp-runtime.cjs");

const {
  activeResumePath,
  activityLogPath,
  commitPatch,
  loadResume,
  proposeEdit,
  readActivityEvents,
  readActivityState,
  readPendingPatch,
  rejectPatch,
  setContact,
  setTitle,
  terminalAgentPath,
  materialsDir,
  extractedDir,
  workspaceDir
} = require("./bin/resume-engine.cjs");

const selectionStatePath = path.join(workspaceDir, "selection-state.json");
const {
  activeSession,
  core,
  sessionManager
} = initializeRuntime({ workspaceDir, resume: loadResume() });
const runtime = createNativeMcpRuntime({ sessionManager, core });

function loadSelectionState() {
  try {
    const raw = fs.readFileSync(selectionStatePath, "utf8");
    return raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

const serverInfo = {
  name: "resume-terminal-studio",
  version: "0.1.0"
};

const toolDefinitions = [
  {
    name: "get_resume",
    description: "Read the active resume JSON and local workspace context.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {}
    }
  },
  {
    name: "propose_edit",
    description: "Propose a finished edit to one resume section. YOU (the agent) must first read the user's materials (workspace/materials/.extracted/*.md) and project files using your own file-reading ability, then WRITE the final polished text yourself and submit it here. This does NOT change the resume directly: it stages a pending patch the user must confirm in the workbench. Returns the diff and a pendingId. Use confirm_patch to apply or reject_patch to discard.\n\nSections:\n- summary: plain text personal summary (no index/field).\n- experience / projects: arrays; use index + (default field 'details').\n- education: array of {school,degree,major,date,tag}; use index + field (one of school/degree/major/date/tag).\n- skills: array of {category,content}; use index + field (one of category/content; default 'content').\nFor structured arrays, proposing with index 0 onto an EMPTY array appends a new item.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["sectionId", "content"],
      properties: {
        sectionId: {
          type: "string",
          enum: ["summary", "experience", "projects", "education", "skills"],
          description: "Which section to edit. For title/contact use set_title/set_contact instead. avatar is set by the user in the workbench, not here."
        },
        index: {
          type: "integer",
          minimum: 0,
          description: "Zero-based index within experience/projects/education/skills arrays. Ignored for summary. Defaults to 0."
        },
        field: {
          type: "string",
          description: "Sub-field to edit for array sections. experience/projects: 'details' (default), 'role', 'company'/'name', 'date'. education: one of school/degree/major/date/tag (default 'school'). skills: one of category/content (default 'content'). Ignored for summary."
        },
        bulletIndex: {
          type: "integer",
          minimum: 0,
          description: "Optional line/bullet index within the 'details' field. When specified, only that single bullet (line) is replaced instead of the entire details text. Lines are 0-indexed and split by newline. Use this for precise edits without rewriting the whole section."
        },
        content: {
          type: "string",
          description: "The finished, ready-to-use text you wrote for this field. The engine stores it verbatim; it does not rewrite it."
        }
      }
    }
  },
  {
    name: "confirm_patch",
    description: "Confirm and apply the currently pending patch to the active resume. Optionally pass the pendingId to guard against confirming a stale patch. Use this only after the user has approved the proposed change.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        pendingId: { type: "string", description: "Optional id of the pending patch to confirm." }
      }
    }
  },
  {
    name: "reject_patch",
    description: "Discard the currently pending patch without changing the resume. Optionally pass the pendingId to guard against rejecting a stale patch.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        pendingId: { type: "string", description: "Optional id of the pending patch to reject." }
      }
    }
  },
  {
    name: "get_pending_patch",
    description: "Read the currently pending (proposed but not yet confirmed) patch, if any.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {}
    }
  },
  {
    name: "set_title",
    description: "Replace the resume title directly.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["text"],
      properties: {
        text: { type: "string" }
      }
    }
  },
  {
    name: "set_contact",
    description: "Replace the resume contact line directly.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["text"],
      properties: {
        text: { type: "string" }
      }
    }
  },
  {
    name: "get_activity",
    description: "Read the latest activity state and recent logged events.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        limit: { type: "integer", minimum: 1, maximum: 100 }
      }
    }
  },
  {
    name: "get_selection",
    description: "Get the user's current selection in the resume preview. Returns which field and section the user has clicked/focused on, so the agent can be context-aware.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {}
    }
  }
];

const resourceDefinitions = [
  {
    uri: "resume://active",
    name: "Active Resume",
    description: "The current active resume JSON document.",
    mimeType: "application/json"
  },
  {
    uri: "resume://activity-state",
    name: "Activity State",
    description: "The latest activity state for terminal-driven edits.",
    mimeType: "application/json"
  },
  {
    uri: "resume://activity-log",
    name: "Activity Log",
    description: "Recent structured activity events from the workspace.",
    mimeType: "application/json"
  }
];

function success(id, result) {
  return { jsonrpc: "2.0", id, result };
}

function failure(id, code, message) {
  return {
    jsonrpc: "2.0",
    id,
    error: { code, message }
  };
}

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

function callTool(name, args = {}) {
  switch (name) {
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
          "Read your source material from the extractedDir (workspace/materials/.extracted/*.md). Run `resume-agent ingest` first if it is empty. Do NOT edit active-resume.json directly — submit edits via propose_edit.",
        resume: runtime.callTool("get_current_resume", {}),
        userSelection: loadSelectionState()
      });
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
          "已生成待确认的改动草稿，尚未写入简历。请等待用户在工作台点击「接受」后再调用 confirm_patch，或调用 reject_patch 放弃。"
      });
    }
    case "confirm_patch": {
      const result = commitPatch(args.pendingId);
      return textContent({
        status: "committed",
        patch: result.patch,
        resume: result.resume
      });
    }
    case "reject_patch": {
      const result = rejectPatch(args.pendingId);
      return textContent({
        status: result.rejected ? "rejected" : "no_pending_patch",
        pending: result.pending || null
      });
    }
    case "get_pending_patch": {
      const pending = runtime.callTool("get_pending_patch", {});
      return textContent({
        pending,
        hasPending: !!pending
      });
    }
    case "set_title": {
      const result = setTitle(args.text);
      return textContent(result);
    }
    case "set_contact": {
      const result = setContact(args.text);
      return textContent(result);
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
        selection: runtime.callTool("get_selection", {}),
        hint: "fieldId format: 'sectionId.index.field' (e.g. 'experience.0.details', 'summary.text'). sectionId is the broad section the user is focused on."
      });
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function handleMessage(message) {
  const { id, method, params } = message;

  if (method === "initialize") {
    return success(id, {
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: {},
        resources: {}
      },
      serverInfo
    });
  }

  if (method === "notifications/initialized") {
    return null;
  }

  if (method === "tools/list") {
    return success(id, { tools: toolDefinitions });
  }

  if (method === "tools/call") {
    const { name, arguments: args } = params || {};
    return success(id, callTool(name, args || {}));
  }

  if (method === "resources/list") {
    return success(id, { resources: resourceDefinitions });
  }

  if (method === "resources/templates/list") {
    return success(id, { resourceTemplates: [] });
  }

  if (method === "resources/read") {
    const uri = params?.uri;
    if (uri === "resume://active") {
      return success(
        id,
        {
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
        }
      );
    }

    if (uri === "resume://activity-state") {
      return success(
        id,
        {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify(readActivityState(), null, 2)
            }
          ]
        }
      );
    }

    if (uri === "resume://activity-log") {
      return success(
        id,
        {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify(readActivityEvents(50), null, 2)
            }
          ]
        }
      );
    }

    return failure(id, -32002, `Unknown resource: ${uri}`);
  }

  return failure(id, -32601, `Method not found: ${method}`);
}

function writeMessage(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

let textBuffer = "";

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  textBuffer += chunk;

  while (true) {
    const newlineIndex = textBuffer.indexOf("\n");
    if (newlineIndex === -1) break;

    const line = textBuffer.slice(0, newlineIndex).trim();
    textBuffer = textBuffer.slice(newlineIndex + 1);
    if (!line) continue;

    try {
      const message = JSON.parse(line);
      const response = handleMessage(message);
      if (response) {
        writeMessage(response);
      }
    } catch (error) {
      writeMessage(failure(null, -32700, error.message));
    }
  }
});
