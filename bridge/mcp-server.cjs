#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { initializeRuntime } = require("./core/runtime.cjs");
const { createNativeMcpRuntime } = require("./mcp-runtime.cjs");

const {
  activeResumePath,
  activityLogPath,
  loadResume,
  proposeEdit,
  readActivityEvents,
  readActivityState,
  readPendingPatch,
  terminalAgentPath,
  materialsDir,
  extractedDir,
  workspaceDir
} = require("./bin/resume-engine.cjs");

const selectionStatePath = path.join(workspaceDir, "selection-state.json");
const contextStatePath = path.join(workspaceDir, "context-state.json");
const defaultResume = {
  name: "Your Name",
  title: "Target Role | Availability | Internship Duration",
  contact: "Phone | Email | Location",
  summary: "",
  experience: [
    {
      company: "Company Name",
      role: "Role Title",
      date: "YYYY.MM-YYYY.MM",
      details:
        "Describe your work with clear outcomes.\nUse one bullet or paragraph per line so AI edits can target individual lines."
    }
  ],
  projects: [
    {
      name: "Project Name",
      role: "Role Title",
      date: "YYYY.MM-YYYY.MM",
      details: "Describe the project goal, your contribution, and measurable result."
    }
  ],
  avatar: null,
  education: [
    {
      school: "School Name",
      degree: "",
      major: "Major",
      date: "YYYY.MM-YYYY.MM",
      tag: ""
    }
  ],
  skills: [
    {
      category: "Tools",
      content: "Figma, Excel, SQL"
    }
  ]
};

function ensureMcpWorkspace() {
  fs.mkdirSync(workspaceDir, { recursive: true });
  fs.mkdirSync(materialsDir, { recursive: true });
  fs.mkdirSync(extractedDir, { recursive: true });
  if (!fs.existsSync(activeResumePath)) {
    fs.writeFileSync(activeResumePath, JSON.stringify(defaultResume, null, 2), "utf8");
  }
}

const {
  activeSession,
  core,
  sessionManager
} = (() => {
  ensureMcpWorkspace();
  return initializeRuntime({ workspaceDir, resume: loadResume() });
})();
const runtime = createNativeMcpRuntime({ sessionManager, core });

function loadSelectionState() {
  try {
    const raw = fs.readFileSync(selectionStatePath, "utf8");
    return raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function readContextState() {
  try {
    const raw = fs.readFileSync(contextStatePath, "utf8");
    const context = raw.trim() ? JSON.parse(raw) : {};
    if (context?.selection && !context.selection.fieldId) {
      context.selection = {
        ...context.selection,
        index: null,
        field: null,
        sectionLabel: context.selection.sectionId ? context.selection.sectionLabel || "" : "",
        fieldLabel: "",
        textPreview: ""
      };
    }
    return context;
  } catch {
    return {};
  }
}

function buildContextPayload() {
  core.setSelection(loadSelectionState());
  return {
    context: readContextState(),
    resume: runtime.callTool("get_current_resume", {}),
    pending: readPendingPatch(),
    workspaceDir,
    activeResumePath,
    materialsDir,
    extractedDir,
    instruction:
      "Use context.selection to target the user's current field. Use get_materials for source evidence. Submit edits only through propose_edit. Do not edit files directly. The user confirms or rejects pending patches in the Resume Studio app."
  };
}

const serverInfo = {
  name: "resume-terminal-studio",
  version: "0.2.0"
};

const toolDefinitions = [
  {
    name: "get_context",
    description: "Read the current UI context: opened document, visible page, selected section/field, active resume, workspace paths, and pending patch. Call this before get_materials and propose_edit.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {}
    }
  },
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
    name: "get_materials",
    description: "Read extracted local source materials in one call, so the agent can start writing without manually discovering workspace/materials/.extracted files. Run `resume-agent ingest` first if this returns no files.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        maxChars: {
          type: "integer",
          minimum: 1000,
          maximum: 200000,
          description: "Maximum total characters returned across extracted material files. Defaults to 60000."
        }
      }
    }
  },
  {
    name: "propose_edit",
    description: "Propose a finished edit to one resume field. First call get_context and get_materials, then WRITE the final polished text yourself and submit it here. This does NOT change the resume directly: it stages a pending patch that only the user can accept or reject in the Resume Studio workbench.\n\nSections:\n- title / contact / summary: plain text, no index/field.\n- experience / projects: arrays; use index + field (default 'details').\n- education: array of {school,degree,major,date,tag}; use index + field (one of school/degree/major/date/tag).\n- skills: array of {category,content}; use index + field (one of category/content; default 'content').\nFor structured arrays, proposing with index 0 onto an EMPTY array appends a new item.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["sectionId", "content"],
      properties: {
        sectionId: {
          type: "string",
          enum: ["title", "contact", "summary", "experience", "projects", "education", "skills"],
          description: "Which section to edit. avatar is set by the user in the workbench, not here."
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
    name: "get_pending_patch",
    description: "Read the currently pending (proposed but not yet confirmed) patch, if any.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {}
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
  },
  {
    uri: "resume://context",
    name: "Resume Studio Context",
    description: "Current document, view, selection, resume, and pending patch context.",
    mimeType: "application/json"
  },
  {
    uri: "resume://materials",
    name: "Extracted Materials",
    description: "Extracted local source materials available to the agent.",
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
        ? "Use these materials to write finished resume copy, then submit via propose_edit. Do not edit active-resume.json directly. The user must accept the pending patch in the app."
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
          "Read your source material from the extractedDir (workspace/materials/.extracted/*.md). Run `resume-agent ingest` first if it is empty. Do NOT edit active-resume.json directly — submit edits via propose_edit and wait for the user to accept them in the app.",
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

    if (uri === "resume://context") {
      return success(
        id,
        {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify(buildContextPayload(), null, 2)
            }
          ]
        }
      );
    }

    if (uri === "resume://materials") {
      return success(
        id,
        {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify(readExtractedMaterials(60000), null, 2)
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
