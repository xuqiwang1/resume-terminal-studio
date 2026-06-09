import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

async function postJson(baseUrl, pathname, body) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = await response.json();
  return { response, payload };
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "resume-server-flow-"));
process.env.WORKSPACE_DIR = tmp;

const activeResumePath = path.join(tmp, "active-resume.json");
const contextStatePath = path.join(tmp, "context-state.json");
const pendingPatchPath = path.join(tmp, "pending-patch.json");

const sourceResume = {
  name: "Original",
  title: "Role",
  contact: "mail@example.com",
  summary: "resume-a",
  avatar: null,
  education: [],
  skills: [],
  experience: [],
  projects: []
};

fs.writeFileSync(activeResumePath, JSON.stringify(sourceResume, null, 2), "utf8");
fs.writeFileSync(
  contextStatePath,
  JSON.stringify(
    {
      version: 1,
      updatedAt: new Date().toISOString(),
      document: {
        documentId: "template:active",
        mode: "template",
        fileName: "",
        historyFileName: "",
        title: "Original-resume",
        activeResumePath,
        revision: 5
      },
      view: { visiblePage: 1, pageCount: 1, scrollTop: 0, zoom: "width", scale: 1 },
      selection: {
        fieldId: "summary",
        sectionId: "summary",
        index: null,
        field: null,
        sectionLabel: "个人总结",
        fieldLabel: "",
        textPreview: "resume-a"
      }
    },
    null,
    2
  ),
  "utf8"
);
fs.writeFileSync(
  pendingPatchPath,
  JSON.stringify(
    {
      id: "pending-1",
      kind: "single",
      sessionId: "session-1",
      documentId: "template:active",
      revision: 5,
      activeResumePath,
      sectionId: "summary",
      before: "resume-a",
      after: "stale patch"
    },
    null,
    2
  ),
  "utf8"
);

const fileStore = await import(`./fileStore.js?server-flow=${Date.now()}`);
await fileStore.saveResumeDocument(
  {
    ...sourceResume,
    name: "Saved Resume",
    summary: "saved file summary"
  },
  "saved-resume"
);

const { startBridgeServer } = await import(`./server.js?server-flow=${Date.now()}`);
const port = await getFreePort();
const handle = await startBridgeServer(port);
const baseUrl = `http://127.0.0.1:${port}`;

try {
  const firstOpen = await postJson(baseUrl, "/api/files/open", { fileName: "saved-resume.rts.json" });
  assert.equal(firstOpen.response.status, 200);
  assert.equal(firstOpen.payload.context.document.documentId, "file:saved-resume.rts.json");
  assert.ok(firstOpen.payload.context.document.revision > 5);

  const pendingAfterFirstOpen = await fetch(`${baseUrl}/api/patch/pending`).then((res) => res.json());
  assert.equal(pendingAfterFirstOpen.pending, null);

  fs.writeFileSync(
    pendingPatchPath,
    JSON.stringify(
      {
        id: "pending-2",
        kind: "single",
        sessionId: "session-2",
        documentId: "file:saved-resume.rts.json",
        revision: firstOpen.payload.context.document.revision,
        activeResumePath,
        sectionId: "summary",
        before: "saved file summary",
        after: "must clear on reopen"
      },
      null,
      2
    ),
    "utf8"
  );

  const secondOpen = await postJson(baseUrl, "/api/files/open", { fileName: "saved-resume.rts.json" });
  assert.equal(secondOpen.response.status, 200);
  assert.equal(secondOpen.payload.context.document.documentId, "file:saved-resume.rts.json");
  assert.ok(
    secondOpen.payload.context.document.revision > firstOpen.payload.context.document.revision,
    "re-opening the same file must bump revision"
  );

  const pendingAfterSecondOpen = await fetch(`${baseUrl}/api/patch/pending`).then((res) => res.json());
  assert.equal(pendingAfterSecondOpen.pending, null);

  const newTemplate = await postJson(baseUrl, "/api/resume/new", { reason: "server-flow-test" });
  assert.equal(newTemplate.response.status, 200);
  assert.equal(newTemplate.payload.context.document.documentId, "template:active");
  assert.equal(newTemplate.payload.context.document.mode, "template");
  assert.ok(
    newTemplate.payload.context.document.revision > secondOpen.payload.context.document.revision,
    "new template flow must atomically bump revision"
  );

  const contextAfterNew = await fetch(`${baseUrl}/api/context`).then((res) => res.json());
  assert.equal(contextAfterNew.context.document.documentId, "template:active");
  assert.equal(
    contextAfterNew.context.document.revision,
    newTemplate.payload.context.document.revision
  );
} finally {
  await new Promise((resolve) => handle.server.close(resolve));
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log("All server document flow checks passed.");
