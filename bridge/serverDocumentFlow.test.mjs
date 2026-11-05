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

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "resume-server-flow-"));
process.env.WORKSPACE_DIR = tmp;
process.env.RESUME_SKIP_DISCOVERY = "1";
// The bridge no longer has an unauthenticated mode, so the test must present a
// credential like any other client.
process.env.RESUME_BRIDGE_TOKEN = "server-flow-test-token";

const authHeaders = { "x-resume-studio-token": process.env.RESUME_BRIDGE_TOKEN };

async function postJson(baseUrl, pathname, body) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify(body)
  });
  const payload = await response.json();
  return { response, payload };
}

function getJson(baseUrl, pathname) {
  return fetch(`${baseUrl}${pathname}`, { headers: authHeaders }).then((res) => res.json());
}

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

const fileStore = await import(`./fileStore.js?server-flow=${Date.now()}`);
await fileStore.saveResumeDocument(
  {
    ...sourceResume,
    name: "Saved Resume",
    summary: "saved file summary"
  },
  "saved-resume"
);

fs.writeFileSync(activeResumePath, JSON.stringify(sourceResume, null, 2), "utf8");
fs.writeFileSync(
  contextStatePath,
  JSON.stringify(
    {
      version: 1,
      updatedAt: new Date().toISOString(),
      document: {
        documentId: "file:saved-resume.rts.json",
        mode: "file",
        fileName: "saved-resume.rts.json",
        historyFileName: "",
        title: "Saved Resume-resume",
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
      documentId: "file:saved-resume.rts.json",
      revision: 5,
      activeResumePath,
      sectionId: "summary",
      before: "saved file summary",
      after: "stale patch"
    },
    null,
    2
  ),
  "utf8"
);

const { startBridgeServer } = await import(`./server.js?server-flow=${Date.now()}`);
const port = await getFreePort();
const handle = await startBridgeServer(port);
const baseUrl = `http://127.0.0.1:${port}`;

try {
  const startupContext = await getJson(baseUrl, "/api/context");
  assert.equal(startupContext.context.document.documentId, "template:active");
  assert.equal(startupContext.context.document.mode, "template");
  assert.ok(startupContext.context.document.revision > 5);

  const pendingAfterStartup = await getJson(baseUrl, "/api/patch/pending");
  assert.equal(pendingAfterStartup.pending, null);

  const externallyEditedResume = {
    ...sourceResume,
    name: "Externally Edited",
    skills: [{ category: "External", content: "disk is authoritative" }]
  };
  fs.writeFileSync(activeResumePath, JSON.stringify(externallyEditedResume, null, 2), "utf8");
  const activeAfterExternalEdit = await getJson(baseUrl, "/api/resume/active");
  assert.equal(activeAfterExternalEdit.resume.name, "Externally Edited");
  assert.deepEqual(activeAfterExternalEdit.resume.skills, externallyEditedResume.skills);
  fs.writeFileSync(activeResumePath, JSON.stringify(sourceResume, null, 2), "utf8");

  const firstOpen = await postJson(baseUrl, "/api/files/open", { fileName: "saved-resume.rts.json" });
  assert.equal(firstOpen.response.status, 200);
  assert.equal(firstOpen.payload.context.document.documentId, "file:saved-resume.rts.json");
  assert.ok(firstOpen.payload.context.document.revision > startupContext.context.document.revision);

  const pendingAfterFirstOpen = await getJson(baseUrl, "/api/patch/pending");
  assert.equal(pendingAfterFirstOpen.pending, null);

  const clientEditedResume = {
    ...firstOpen.payload.document.resume,
    avatar: "data:image/png;base64,avatar",
    avatarPos: { x: 12, y: -4 },
    fieldStyles: {
      "projects.0.name": { fontWeight: "700" }
    },
    layoutConfig: {
      education: { schoolAlign: "left", majorAlign: "right" },
      skills: { layout: "inline" }
    },
    projects: [{ name: "Manual Project", role: "", date: "", details: "manual edit must survive" }]
  };
  fs.writeFileSync(
    pendingPatchPath,
    JSON.stringify(
      {
        id: "pending-ui-state",
        kind: "single",
        sessionId: "session-ui-state",
        documentId: "file:saved-resume.rts.json",
        revision: firstOpen.payload.context.document.revision,
        activeResumePath,
        sectionId: "summary",
        before: "saved file summary",
        after: "AI patched summary"
      },
      null,
      2
    ),
    "utf8"
  );

  // Confirm takes presentation from the client (it may hold unsaved styling) but
  // content from disk (that is where agents write, and what conflict detection
  // must compare against). Here disk and client content agree apart from the
  // patched field, so the accept succeeds.
  const confirmWithClientState = await postJson(baseUrl, "/api/patch/confirm", {
    pendingId: "pending-ui-state",
    resume: clientEditedResume
  });
  assert.equal(confirmWithClientState.response.status, 200);
  assert.equal(confirmWithClientState.payload.resume.summary, "AI patched summary");
  assert.equal(confirmWithClientState.payload.resume.avatar, clientEditedResume.avatar);
  assert.deepEqual(confirmWithClientState.payload.resume.avatarPos, clientEditedResume.avatarPos);
  assert.deepEqual(confirmWithClientState.payload.resume.fieldStyles, clientEditedResume.fieldStyles);
  assert.deepEqual(confirmWithClientState.payload.resume.layoutConfig, clientEditedResume.layoutConfig);
  // Content comes from the file, not from the request body.
  assert.deepEqual(
    confirmWithClientState.payload.resume.projects,
    [],
    "content must come from disk, not the client's copy"
  );

  // An edit that reaches disk between propose and accept must be REPORTED, not
  // overwritten. Previously the server hydrated from the client's resume before
  // checking, so it compared that copy against itself and the disk edit was lost.
  const diskEditedResume = {
    ...sourceResume,
    summary: "a human edited this on disk after the patch was proposed"
  };
  fs.writeFileSync(activeResumePath, JSON.stringify(diskEditedResume, null, 2), "utf8");
  fs.writeFileSync(
    pendingPatchPath,
    JSON.stringify(
      {
        id: "pending-conflict",
        kind: "single",
        sessionId: "session-conflict",
        documentId: "file:saved-resume.rts.json",
        revision: firstOpen.payload.context.document.revision,
        activeResumePath,
        sectionId: "summary",
        before: "AI patched summary",
        after: "patch that must not silently win"
      },
      null,
      2
    ),
    "utf8"
  );

  const staleConfirm = await postJson(baseUrl, "/api/patch/confirm", {
    pendingId: "pending-conflict",
    // The client still believes the pre-edit text is current.
    resume: { ...clientEditedResume, summary: "AI patched summary" }
  });
  assert.equal(staleConfirm.response.status, 409, "a disk edit under the patch must conflict");
  assert.ok(Array.isArray(staleConfirm.payload.conflicts) && staleConfirm.payload.conflicts.length);
  assert.equal(staleConfirm.payload.conflicts[0].sectionId, "summary");
  assert.equal(
    staleConfirm.payload.conflicts[0].actual,
    diskEditedResume.summary,
    "the conflict must report what is actually on disk"
  );
  const resumeAfterConflict = await getJson(baseUrl, "/api/resume/active");
  assert.equal(
    resumeAfterConflict.resume.summary,
    diskEditedResume.summary,
    "the disk edit must survive a refused confirm"
  );

  // The same patch applies once the user acknowledges the conflict.
  const forcedConfirm = await postJson(baseUrl, "/api/patch/confirm", {
    pendingId: "pending-conflict",
    resume: { ...clientEditedResume, summary: "AI patched summary" },
    allowConflict: true
  });
  assert.equal(forcedConfirm.response.status, 200);
  assert.equal(forcedConfirm.payload.resume.summary, "patch that must not silently win");

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

  const pendingAfterSecondOpen = await getJson(baseUrl, "/api/patch/pending");
  assert.equal(pendingAfterSecondOpen.pending, null);

  fs.writeFileSync(
    pendingPatchPath,
    JSON.stringify(
      {
        id: "pending-3",
        kind: "single",
        sessionId: "session-3",
        documentId: "file:saved-resume.rts.json",
        revision: secondOpen.payload.context.document.revision,
        activeResumePath,
        sectionId: "summary",
        before: "saved file summary",
        after: "must not survive concurrent open"
      },
      null,
      2
    ),
    "utf8"
  );

  const concurrentOpenPromise = postJson(baseUrl, "/api/resume/new", { reason: "concurrent-open" });
  await new Promise((resolve) => setTimeout(resolve, 0));
  const concurrentConfirmPromise = postJson(baseUrl, "/api/patch/confirm", { pendingId: "pending-3" });
  const [concurrentOpen, concurrentConfirm] = await Promise.all([
    concurrentOpenPromise,
    concurrentConfirmPromise
  ]);

  assert.equal(concurrentOpen.response.status, 200);
  assert.notEqual(concurrentConfirm.response.status, 200);
  const resumeAfterConcurrent = await getJson(baseUrl, "/api/resume/active");
  assert.equal(resumeAfterConcurrent.resume.summary, concurrentOpen.payload.resume.summary);
  const pendingAfterConcurrent = await getJson(baseUrl, "/api/patch/pending");
  assert.equal(pendingAfterConcurrent.pending, null);

  // Content autosave: the workbench had no way to persist text at all, only
  // styling, so anything typed lived in React state until a manual save.
  const autosaved = await postJson(baseUrl, "/api/resume/content", {
    resume: { ...sourceResume, summary: "typed into the workbench" }
  });
  assert.equal(autosaved.response.status, 200);
  const afterAutosave = await getJson(baseUrl, "/api/resume/active");
  assert.equal(afterAutosave.resume.summary, "typed into the workbench");
  const rejectedAutosave = await postJson(baseUrl, "/api/resume/content", { resume: "not an object" });
  assert.equal(rejectedAutosave.response.status, 400);

  // A malformed index used to arrive as `null` and be read as item 0.
  const badIndex = await postJson(baseUrl, "/api/patch/propose", {
    patch: { sectionId: "experience", index: null, after: "x" }
  });
  assert.equal(badIndex.response.status, 400);
  assert.match(badIndex.payload.error, /index must be a non-negative integer/);

  // Unauthenticated requests are refused; the bridge has no open mode now.
  const unauthorized = await fetch(`${baseUrl}/api/health`);
  assert.equal(unauthorized.status, 401);
  // The token is accepted as a query parameter only on the SSE endpoints.
  const queryTokenOnMutating = await fetch(
    `${baseUrl}/api/resume/active?token=${process.env.RESUME_BRIDGE_TOKEN}`
  );
  assert.equal(queryTokenOnMutating.status, 401);
  const foreignOrigin = await fetch(`${baseUrl}/api/health`, {
    headers: { ...authHeaders, origin: "https://evil.example.com" }
  });
  assert.equal(foreignOrigin.status, 403);

  const newTemplate = await postJson(baseUrl, "/api/resume/new", { reason: "server-flow-test" });
  assert.equal(newTemplate.response.status, 200);
  assert.equal(newTemplate.payload.context.document.documentId, "template:active");
  assert.equal(newTemplate.payload.context.document.mode, "template");
  assert.ok(
    newTemplate.payload.context.document.revision > secondOpen.payload.context.document.revision,
    "new template flow must atomically bump revision"
  );

  const contextAfterNew = await getJson(baseUrl, "/api/context");
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
