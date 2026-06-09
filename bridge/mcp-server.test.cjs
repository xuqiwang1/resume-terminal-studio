// Verifies the stdio MCP server can start from a clean workspace and expose
// the fast material-reading tool agents should use before proposing edits.
// Run: node bridge/mcp-server.test.cjs
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "resume-mcp-server-"));
const extractedDir = path.join(tmp, "materials", ".extracted");
fs.mkdirSync(extractedDir, { recursive: true });
fs.writeFileSync(
  path.join(extractedDir, "index.md"),
  "# Extracted materials index\n\n- project-notes.md\n",
  "utf8"
);
fs.writeFileSync(
  path.join(extractedDir, "project-notes.md"),
  "# Project notes\n\nBuilt a local-first Resume Studio workflow.",
  "utf8"
);
fs.writeFileSync(
  path.join(tmp, "context-state.json"),
  JSON.stringify({
    version: 1,
    updatedAt: new Date().toISOString(),
    document: {
      documentId: "template:active",
      mode: "template",
      fileName: "",
      historyFileName: "",
      title: "Demo",
      activeResumePath: path.join(tmp, "active-resume.json"),
      revision: 9
    },
    view: { visiblePage: 1, pageCount: 1, scrollTop: 0, zoom: "width", scale: 1 },
    selection: {
      fieldId: "experience.0.details",
      sectionId: "experience",
      index: 0,
      field: "details",
      sectionLabel: "实习经历",
      fieldLabel: "详情",
      textPreview: "Built a local-first workflow."
    }
  }),
  "utf8"
);

const child = spawn("node", [path.join(__dirname, "mcp-server.cjs")], {
  env: { ...process.env, WORKSPACE_DIR: tmp },
  stdio: ["pipe", "pipe", "pipe"]
});

let buffer = "";
const responses = new Map();
const stderr = [];

child.stdout.on("data", (chunk) => {
  buffer += chunk.toString();
  while (true) {
    const newlineIndex = buffer.indexOf("\n");
    if (newlineIndex === -1) break;
    const line = buffer.slice(0, newlineIndex).trim();
    buffer = buffer.slice(newlineIndex + 1);
    if (!line) continue;
    const message = JSON.parse(line);
    responses.set(message.id, message);
  }
});

child.stderr.on("data", (chunk) => {
  stderr.push(chunk.toString());
});

function send(id, method, params) {
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
}

function waitFor(id, timeoutMs = 2000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (responses.has(id)) return resolve(responses.get(id));
      if (Date.now() - startedAt > timeoutMs) {
        return reject(new Error(`Timed out waiting for MCP response ${id}. stderr: ${stderr.join("")}`));
      }
      setTimeout(tick, 20);
    };
    tick();
  });
}

let failures = 0;
function check(name, cond) {
  if (cond) console.log(`  ok  - ${name}`);
  else {
    console.error(`  FAIL - ${name}`);
    failures += 1;
  }
}

(async () => {
  try {
    send(1, "initialize", {});
    const init = await waitFor(1);
    check("initialize returns server info", init.result?.serverInfo?.name === "resume-terminal-studio");
    check("server version is bumped so cached clients refresh schemas", init.result?.serverInfo?.version === "0.2.0");
    check("clean workspace gets a template resume", fs.existsSync(path.join(tmp, "active-resume.json")));

    send(2, "tools/list", {});
    const list = await waitFor(2);
    const toolNames = list.result?.tools?.map((tool) => tool.name) || [];
    check("tools/list includes get_context", toolNames.includes("get_context"));
    check("tools/list includes get_materials", toolNames.includes("get_materials"));
    check("tools/list includes propose_edit", toolNames.includes("propose_edit"));
    check("tools/list includes propose_batch_edit", toolNames.includes("propose_batch_edit"));
    check("MCP agents cannot confirm patches themselves", !toolNames.includes("confirm_patch"));
    check("MCP agents cannot reject patches themselves", !toolNames.includes("reject_patch"));
    check("MCP agents cannot directly set title", !toolNames.includes("set_title"));
    check("MCP agents cannot directly set contact", !toolNames.includes("set_contact"));

    send(3, "tools/call", { name: "get_materials", arguments: { maxChars: 10000 } });
    const materials = await waitFor(3);
    const text = materials.result?.content?.[0]?.text || "";
    check("get_materials returns extracted file content", text.includes("Project notes"));
    check("get_materials returns guidance", text.includes("propose_edit"));

    send(4, "tools/call", { name: "get_context", arguments: {} });
    const context = await waitFor(4);
    const contextText = context.result?.content?.[0]?.text || "";
    check("get_context returns selected field", contextText.includes("experience.0.details"));
    check("get_context returns visible page", contextText.includes('"visiblePage": 1'));
    check("context includes workspace diagnostics", contextText.includes('"workspaceDiagnostics"'));
    check("context includes active document", contextText.includes('"activeDocument"'));
    check("context includes active document id", contextText.includes('"documentId": "template:active"'));
    check("context reports aligned workspace", contextText.includes('"aligned": true'));

    send(5, "resources/read", { uri: "resume://context" });
    const contextResource = await waitFor(5);
    check("resume://context resource returns context", JSON.stringify(contextResource).includes("Built a local-first workflow"));

    send(6, "tools/call", {
      name: "propose_edit",
      arguments: {
        sectionId: "name",
        content: "许起旺"
      }
    });
    const nameResponse = await waitFor(6);
    const nameText = nameResponse.result?.content?.[0]?.text || "";
    check("propose_edit supports name section", nameText.includes('"sectionId": "name"'));
    check("propose_edit for name returns pending confirmation", nameText.includes('"status": "pending_confirmation"'));

    send(7, "tools/call", {
      name: "propose_batch_edit",
      arguments: {
        title: "Fill education",
        summary: "Replace one and append one",
        changes: [
          {
            operation: "replace_item",
            sectionId: "education",
            index: 0,
            value: {
              school: "北京师范大学",
              degree: "硕士",
              major: "社会学",
              date: "2024.09 - 2027.06",
              tag: "985"
            }
          }
        ]
      }
    });
    const batchResponse = await waitFor(7);
    const batchText = batchResponse.result?.content?.[0]?.text || "";
    check("propose_batch_edit returns pending confirmation", batchText.includes('"status": "pending_confirmation"'));
    check("propose_batch_edit returns batch kind", batchText.includes('"kind": "batch"'));
    check("propose_batch_edit returns title", batchText.includes('"title": "Fill education"'));
    check("batch response returns change count", batchText.includes('"changeCount": 1'));
    check("batch response includes sections", batchText.includes('"sections"'));
    check("batch response includes duration", batchText.includes('"durationMs"'));
    check("batch response does not echo full changes", !batchText.includes('"changes": ['));
    check("batch response omits normalized before/after payloads", !batchText.includes('"before": {'));

    send(8, "tools/call", {
      name: "propose_batch_edit",
      arguments: {
        title: "Bad batch",
        changes: [{ operation: "replace_field", sectionId: "title", value: "x" }]
      }
    });
    const invalidBatch = await waitFor(8);
    check("invalid batch returns request-scoped error id", invalidBatch.id === 8);
    check("invalid batch returns schema error text", invalidBatch.error?.message === "title replace_field requires field");

    fs.writeFileSync(
      path.join(tmp, "context-state.json"),
      JSON.stringify({ version: 1, document: { mode: "template", title: "Missing binding" } }, null, 2),
      "utf8"
    );
    send(9, "tools/call", {
      name: "propose_edit",
      arguments: {
        sectionId: "summary",
        content: "Should fail without active document binding"
      }
    });
    const missingContext = await waitFor(9);
    check("missing active document returns request-scoped error id", missingContext.id === 9);
    check(
      "missing active document returns explicit error",
      missingContext.error?.message.includes("active document context is missing")
    );
  } finally {
    child.kill();
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll MCP server checks passed.");
})();
