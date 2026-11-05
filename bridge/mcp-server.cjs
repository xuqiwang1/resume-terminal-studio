#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { initializeRuntime } = require("./core/runtime.cjs");
const { createNativeMcpRuntime } = require("./mcp-runtime.cjs");
const { createDefaultResume } = require("./defaultResume.cjs");
const { toolDefinitions, resourceDefinitions } = require("./mcpDefinitions.cjs");
const { createMcpHandlers } = require("./mcpHandlers.cjs");

const {
  activeResumePath,
  activityLogPath,
  loadResume,
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
const defaultResume = createDefaultResume();

function ensureMcpWorkspace() {
  fs.mkdirSync(workspaceDir, { recursive: true });
  fs.mkdirSync(materialsDir, { recursive: true });
  fs.mkdirSync(extractedDir, { recursive: true });
  if (!fs.existsSync(activeResumePath)) {
    fs.writeFileSync(activeResumePath, JSON.stringify(defaultResume, null, 2), "utf8");
  }
}

// A throw at module scope used to kill the MCP server before it could speak
// JSON-RPC, so the client saw an opaque "server exited" with no reason. Startup
// failures are reported on stderr (stdout is the protocol channel) and the
// process exits with a non-zero code.
const {
  activeSession,
  core,
  sessionManager
} = (() => {
  try {
    ensureMcpWorkspace();
    return initializeRuntime({ workspaceDir, resume: loadResume() });
  } catch (error) {
    process.stderr.write(
      `[resume-studio-mcp] failed to start: ${error.message}\n` +
        `  workspaceDir: ${workspaceDir}\n` +
        `  activeResumePath: ${activeResumePath}\n`
    );
    process.exit(1);
  }
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
  const context = readContextState();
  const activeDocument = context.document || null;
  const workspaceDiagnostics = {
    mcpWorkspaceDir: workspaceDir,
    activeResumePath,
    appDocumentPath: activeDocument?.activeResumePath || "",
    aligned:
      !activeDocument?.activeResumePath ||
      path.resolve(activeDocument.activeResumePath) === path.resolve(activeResumePath)
  };
  if (activeDocument) {
    core.hydrateActiveDocument(activeDocument);
  }
  return {
    context,
    activeDocument,
    workspaceDiagnostics,
    resume: runtime.callTool("get_current_resume", {}),
    pending: readPendingPatch(),
    workspaceDir,
    activeResumePath,
    materialsDir,
    extractedDir,
    instruction:
      "Use context.selection to target the user's current field. Use get_materials for source evidence. Submit one narrow edit through propose_edit, or one coherent multi-field task through propose_batch_edit. Do not edit files directly. The user confirms or rejects pending patches in the Resume Studio app."
  };
}

const serverInfo = {
  name: "resume-terminal-studio",
  version: "0.2.0"
};

const { callTool, readResource } = createMcpHandlers({
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
  readPendingPatch,
  runtime,
  terminalAgentPath,
  workspaceDir,
  buildContextPayload
});

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

const SUPPORTED_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const FALLBACK_PROTOCOL_VERSION = "2024-11-05";

function negotiateProtocolVersion(requested) {
  // Hardcoding one version meant a client on a newer revision was answered with
  // a version it had not asked for. Echo the client's version when we support it.
  if (typeof requested === "string" && SUPPORTED_PROTOCOL_VERSIONS.includes(requested)) {
    return requested;
  }
  return FALLBACK_PROTOCOL_VERSION;
}

function handleMessage(message) {
  const { id, method, params } = message;

  if (typeof method !== "string") {
    return failure(id ?? null, -32600, "Invalid request: missing method");
  }

  if (method === "initialize") {
    return success(id, {
      protocolVersion: negotiateProtocolVersion(params?.protocolVersion),
      capabilities: {
        tools: {},
        resources: {}
      },
      serverInfo
    });
  }

  // A JSON-RPC notification has no id and must never be answered. Replying only
  // to `notifications/initialized` meant every other notification got an error
  // object back, which is a protocol violation.
  if (method.startsWith("notifications/") || id === undefined || id === null) {
    return null;
  }

  if (method === "tools/list") {
    return success(id, { tools: toolDefinitions });
  }

  if (method === "tools/call") {
    try {
      const { name, arguments: args } = params || {};
      return success(id, callTool(name, args || {}));
    } catch (error) {
      return failure(id, -32002, error.message);
    }
  }

  if (method === "resources/list") {
    return success(id, { resources: resourceDefinitions });
  }

  if (method === "resources/templates/list") {
    return success(id, { resourceTemplates: [] });
  }

  if (method === "resources/read") {
    try {
      return success(id, readResource(params?.uri));
    } catch (error) {
      return failure(id, -32002, error.message);
    }
  }

  return failure(id, -32601, `Method not found: ${method}`);
}

function writeMessage(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

let textBuffer = "";

// A client that never sends a newline would otherwise grow this buffer until the
// process runs out of memory. 32 MiB is far above any legitimate request.
const MAX_BUFFER_BYTES = 32 * 1024 * 1024;

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  textBuffer += chunk;

  if (textBuffer.length > MAX_BUFFER_BYTES) {
    textBuffer = "";
    writeMessage(
      failure(null, -32700, `Request exceeded ${MAX_BUFFER_BYTES} bytes without a newline; buffer discarded`)
    );
    return;
  }

  while (true) {
    const newlineIndex = textBuffer.indexOf("\n");
    if (newlineIndex === -1) break;

    const line = textBuffer.slice(0, newlineIndex).trim();
    textBuffer = textBuffer.slice(newlineIndex + 1);
    if (!line) continue;

    let message;
    try {
      message = JSON.parse(line);
    } catch (error) {
      writeMessage(failure(null, -32700, error.message));
      continue;
    }
    // A throw inside handleMessage used to be reported as a parse error, hiding
    // the real cause, and an unexpected one could tear down the stdin handler.
    try {
      const response = handleMessage(message);
      if (response) {
        writeMessage(response);
      }
    } catch (error) {
      writeMessage(failure(message?.id ?? null, -32603, error.message));
    }
  }
});
