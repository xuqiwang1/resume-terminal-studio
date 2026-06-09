import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "resume-context-"));
process.env.WORKSPACE_DIR = tmp;

const store = await import(`./fileStore.js?context-test=${Date.now()}`);

await store.writeContextState({
  document: {
    documentId: "file:bad.rts.json",
    mode: "file",
    fileName: "../bad.rts.json",
    title: "Demo",
    activeResumePath: path.join(tmp, "active-resume.json"),
    revision: 42
  },
  view: { visiblePage: 0, pageCount: 0, scrollTop: -10, zoom: "width", scale: 1.2 },
  selection: {
    fieldId: "experience.2.details",
    sectionId: "experience",
    index: 2,
    field: "details",
    sectionLabel: "实习经历",
    fieldLabel: "详情",
    textPreview: "x".repeat(1000)
  }
});

const context = await store.readContextState();

assert.equal(context.version, 1);
assert.equal(context.document.documentId, "file:bad.rts.json");
assert.equal(context.document.mode, "file");
assert.equal(context.document.fileName, "bad.rts.json");
assert.equal(context.document.activeResumePath, path.join(tmp, "active-resume.json"));
assert.equal(context.document.revision, 42);
assert.equal(context.view.visiblePage, 1);
assert.equal(context.view.pageCount, 1);
assert.equal(context.view.scrollTop, 0);
assert.equal(context.selection.fieldId, "experience.2.details");
assert.equal(context.selection.textPreview.length, 400);

await store.writeSelectionState({ fieldId: "skills.0.content", sectionId: "skills" });
const afterLegacySelection = await store.readContextState();
assert.equal(afterLegacySelection.selection.fieldId, "skills.0.content");
assert.equal(afterLegacySelection.selection.sectionId, "skills");

fs.rmSync(tmp, { recursive: true, force: true });
console.log("All context store checks passed.");
