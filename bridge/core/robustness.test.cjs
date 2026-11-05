// Regression tests for the robustness fixes:
//  1. atomic writes leave no partial file and no temp litter
//  2. a corrupt resume is quarantined instead of silently becoming null
//  3. the single pending slot is not silently overwritten
//  4. confirm persists to disk before advancing memory
//  5. staleness checks fail closed
//  6. apply refuses a target that disappeared (no phantom items)
//  7. presentation-only merge keeps content under disk authority
// Run: node bridge/core/robustness.test.cjs

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { readJsonSync, writeJsonAtomicSync, writeFileAtomicSync } = require("../core/atomicFile.cjs");
const { createPersistence } = require("../core/persistence.cjs");
const { createEventBus } = require("../core/eventBus.cjs");
const {
  createResumeCore,
  isPendingStaleForActiveDocument
} = require("../core/resumeCore.cjs");
const { mergePresentationOnto } = require("../core/presentationMerge.cjs");

let failures = 0;
function check(name, fn) {
  try {
    fn();
    console.log(`  ok  - ${name}`);
  } catch (error) {
    console.error(`  FAIL - ${name}: ${error.message}`);
    failures += 1;
  }
}

function tempWorkspace() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "resume-robustness-"));
}

const BASE_RESUME = {
  name: "Tester",
  title: "Role",
  contact: "Contact",
  summary: "Original summary",
  experience: [{ company: "Acme", role: "PM", date: "2024", details: "line one\nline two" }],
  projects: [],
  education: [{ school: "School", degree: "", major: "", date: "", tag: "" }],
  skills: [{ category: "Tools", content: "Figma" }]
};

function boundCore(workspaceDir, resume = BASE_RESUME) {
  const persistence = createPersistence({ workspaceDir });
  persistence.saveResume(resume);
  const bus = createEventBus();
  const core = createResumeCore({ bus, persistence });
  core.hydrateActiveDocument({
    documentId: "test:active",
    mode: "template",
    fileName: "",
    historyFileName: "",
    title: "test",
    activeResumePath: path.join(workspaceDir, "active-resume.json"),
    revision: 1
  });
  return { bus, core, persistence };
}

// ---- 1. atomic writes ----

check("writeJsonAtomicSync leaves no temp files behind", () => {
  const dir = tempWorkspace();
  const target = path.join(dir, "data.json");
  writeJsonAtomicSync(target, { a: 1 });
  assert.deepEqual(JSON.parse(fs.readFileSync(target, "utf8")), { a: 1 });
  const leftovers = fs.readdirSync(dir).filter((name) => name.startsWith("."));
  assert.deepEqual(leftovers, [], `unexpected temp files: ${leftovers.join(", ")}`);
});

check("writeFileAtomicSync replaces content wholesale", () => {
  const dir = tempWorkspace();
  const target = path.join(dir, "notes.txt");
  writeFileAtomicSync(target, "first");
  writeFileAtomicSync(target, "second");
  assert.equal(fs.readFileSync(target, "utf8"), "second");
});

check("writeJsonAtomicSync fails without clobbering the existing file", () => {
  const dir = tempWorkspace();
  const target = path.join(dir, "data.json");
  writeJsonAtomicSync(target, { keep: true });
  const circular = {};
  circular.self = circular;
  assert.throws(() => writeJsonAtomicSync(target, circular));
  assert.deepEqual(JSON.parse(fs.readFileSync(target, "utf8")), { keep: true });
});

// ---- 2. corruption is distinguishable from absence ----

check("readJsonSync reports a missing file as missing, not corrupt", () => {
  const dir = tempWorkspace();
  const result = readJsonSync(path.join(dir, "nope.json"), { fallback: null });
  assert.equal(result.missing, true);
  assert.equal(result.corrupt, false);
});

check("readJsonSync reports and quarantines a corrupt file", () => {
  const dir = tempWorkspace();
  const target = path.join(dir, "broken.json");
  fs.writeFileSync(target, '{"half": ');
  const result = readJsonSync(target, { fallback: null, quarantine: true });
  assert.equal(result.corrupt, true);
  assert.ok(result.quarantinePath, "expected a quarantine path");
  assert.equal(fs.existsSync(result.quarantinePath), true);
  assert.equal(fs.existsSync(target), false, "corrupt file should have been moved aside");
});

check("persistence surfaces resume corruption instead of swallowing it", () => {
  const dir = tempWorkspace();
  const persistence = createPersistence({ workspaceDir: dir });
  persistence.saveResume(BASE_RESUME);
  fs.writeFileSync(path.join(dir, "active-resume.json"), '{"name": "trunc');
  assert.equal(persistence.loadResume(), null);
  const events = persistence.getCorruptionEvents();
  assert.equal(events.length, 1);
  assert.equal(events[0].file, "active-resume.json");
  assert.ok(events[0].quarantinePath, "corrupt resume should be preserved for recovery");
});

// ---- 3. single pending slot ----

check("a second proposal is refused rather than overwriting the first", () => {
  const dir = tempWorkspace();
  const { core } = boundCore(dir);
  const first = core.proposeSectionEdit({ sessionId: "s1", sectionId: "summary", content: "First draft" });
  assert.throws(
    () => core.proposeSectionEdit({ sessionId: "s1", sectionId: "title", content: "Second draft" }),
    (error) => error.name === "PendingPatchExists" && error.pendingId === first.id
  );
  assert.equal(core.getPendingPatch().id, first.id, "the first patch must survive");
  assert.equal(core.getPendingPatch().after, "First draft");
});

check("replace=true deliberately discards the awaiting patch", () => {
  const dir = tempWorkspace();
  const { core } = boundCore(dir);
  core.proposeSectionEdit({ sessionId: "s1", sectionId: "summary", content: "First draft" });
  const second = core.proposeSectionEdit({
    sessionId: "s1",
    sectionId: "title",
    content: "Second draft",
    replace: true
  });
  assert.equal(core.getPendingPatch().id, second.id);
  assert.equal(core.getPendingPatch().after, "Second draft");
});

check("a batch proposal is also refused while a patch awaits review", () => {
  const dir = tempWorkspace();
  const { core } = boundCore(dir);
  core.proposeSectionEdit({ sessionId: "s1", sectionId: "summary", content: "First draft" });
  assert.throws(
    () =>
      core.proposeBatchEdit({
        sessionId: "s1",
        title: "Batch",
        changes: [{ operation: "replace_field", sectionId: "title", value: "New" }]
      }),
    (error) => error.name === "PendingPatchExists"
  );
});

// ---- 4. confirm ordering ----

check("confirm writes disk before advancing memory", () => {
  const dir = tempWorkspace();
  const persistence = createPersistence({ workspaceDir: dir });
  persistence.saveResume(BASE_RESUME);
  const bus = createEventBus();
  const failing = {
    ...persistence,
    saveResume() {
      throw new Error("disk full");
    }
  };
  const core = createResumeCore({ bus, persistence: failing });
  core.hydrateActiveDocument({
    documentId: "test:active",
    mode: "template",
    fileName: "",
    historyFileName: "",
    title: "test",
    activeResumePath: path.join(dir, "active-resume.json"),
    revision: 1
  });
  const pending = core.proposeSectionEdit({
    sessionId: "s1",
    sectionId: "summary",
    content: "Rewritten summary"
  });
  assert.throws(() => core.confirmPendingPatch({ pendingId: pending.id }), /disk full/);
  // Memory must not have advanced past the failed write.
  assert.equal(core.getResume().summary, "Original summary");
  // And the patch is still reviewable rather than consumed.
  assert.equal(core.getPendingPatch()?.id, pending.id);
});

check("a successful confirm persists and clears the slot", () => {
  const dir = tempWorkspace();
  const { core, persistence } = boundCore(dir);
  const pending = core.proposeSectionEdit({
    sessionId: "s1",
    sectionId: "summary",
    content: "Rewritten summary"
  });
  core.confirmPendingPatch({ pendingId: pending.id });
  assert.equal(core.getResume().summary, "Rewritten summary");
  assert.equal(persistence.loadResume().summary, "Rewritten summary");
  assert.equal(persistence.loadPendingPatch(), null);
  assert.equal(core.getPendingPatch(), null);
});

// ---- 5. staleness fails closed ----

check("a patch with no revision is treated as stale", () => {
  assert.equal(
    isPendingStaleForActiveDocument({ documentId: "a", revision: undefined }, { documentId: "a", revision: 3 }),
    true
  );
});

check("a document with no revision is treated as stale", () => {
  assert.equal(
    isPendingStaleForActiveDocument({ documentId: "a", revision: 3 }, { documentId: "a", revision: null }),
    true
  );
});

check("matching document and revision is not stale", () => {
  assert.equal(
    isPendingStaleForActiveDocument({ documentId: "a", revision: 3 }, { documentId: "a", revision: 3 }),
    false
  );
});

check("a differing documentId is stale", () => {
  assert.equal(
    isPendingStaleForActiveDocument({ documentId: "a", revision: 3 }, { documentId: "b", revision: 3 }),
    true
  );
});

// ---- 6. no phantom items ----

check("confirm refuses a single patch whose target item disappeared", () => {
  const dir = tempWorkspace();
  const { core } = boundCore(dir);
  const pending = core.proposeSectionEdit({
    sessionId: "s1",
    sectionId: "experience",
    index: 0,
    field: "details",
    content: "Updated details"
  });
  // The item is gone by the time the user accepts.
  core.hydrateResume({ ...BASE_RESUME, experience: [] });
  assert.throws(
    () => core.confirmPendingPatch({ pendingId: pending.id, allowConflict: true }),
    /experience\[0\] no longer exists/
  );
});

check("confirm refuses a batch change whose target item disappeared", () => {
  const dir = tempWorkspace();
  const { core } = boundCore(dir);
  const pending = core.proposeBatchEdit({
    sessionId: "s1",
    title: "Update skills",
    changes: [{ operation: "replace_field", sectionId: "skills", index: 0, field: "content", value: "Sketch" }]
  });
  core.hydrateResume({ ...BASE_RESUME, skills: [] });
  assert.throws(
    () => core.confirmPendingPatch({ pendingId: pending.id, allowConflict: true }),
    /skills\[0\] no longer exists/
  );
  // Crucially, no phantom `{content: "Sketch"}` item was created.
  assert.deepEqual(core.getResume().skills, []);
});

// ---- 7. presentation-only merge ----

check("presentation merge keeps disk content and client styling", () => {
  const disk = { summary: "from disk", styleSettings: { fontId: "old" } };
  const client = { summary: "stale client copy", styleSettings: { fontId: "new" } };
  const merged = mergePresentationOnto(disk, client);
  assert.equal(merged.summary, "from disk", "content must come from disk");
  assert.deepEqual(merged.styleSettings, { fontId: "new" }, "styling must come from the client");
});

check("presentation merge ignores keys the client never sent", () => {
  const disk = { summary: "from disk", styleSettings: { fontId: "old" }, avatar: "data:image/png;base64,x" };
  const merged = mergePresentationOnto(disk, { summary: "stale" });
  assert.deepEqual(merged.styleSettings, { fontId: "old" });
  assert.equal(merged.avatar, "data:image/png;base64,x");
});

check("presentation merge honours an explicitly cleared avatar", () => {
  const disk = { summary: "from disk", avatar: "data:image/png;base64,x" };
  const merged = mergePresentationOnto(disk, { avatar: null });
  assert.equal(merged.avatar, null);
});

check("presentation merge never lets the client inject content", () => {
  const disk = { summary: "from disk", experience: [{ company: "Acme" }] };
  const merged = mergePresentationOnto(disk, {
    summary: "injected",
    experience: [{ company: "Evil" }],
    name: "injected"
  });
  assert.equal(merged.summary, "from disk");
  assert.deepEqual(merged.experience, [{ company: "Acme" }]);
  assert.equal(merged.name, undefined);
});

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll robustness checks passed.");
