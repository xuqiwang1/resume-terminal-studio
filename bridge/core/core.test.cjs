const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "resume-core-"));
process.env.WORKSPACE_DIR = tmp;

const { createEventBus } = require("./eventBus.cjs");
const { createPersistence } = require("./persistence.cjs");
const { createResumeCore } = require("./resumeCore.cjs");

const events = [];
const bus = createEventBus();
bus.on("resume.updated", (payload) => events.push(payload));

const persistence = createPersistence({ workspaceDir: tmp });
persistence.saveResume({ name: "Test", summary: "" });
bus.emit("resume.updated", { source: "test", resumeId: "active" });

assert.equal(events.length, 1);
assert.equal(
  JSON.parse(fs.readFileSync(path.join(tmp, "active-resume.json"), "utf8")).name,
  "Test"
);

const core = createResumeCore({ bus, persistence });
core.setResume({
  name: "Test",
  summary: "",
  experience: [{ details: "before detail" }],
  projects: [],
  education: [],
  skills: []
});

const pending = core.proposeSectionEdit({
  sessionId: "session-1",
  sectionId: "summary",
  content: "new summary"
});

assert.equal(core.getPendingPatch().after, "new summary");
assert.equal(core.getResume().summary, "");

core.confirmPendingPatch({ sessionId: "session-1", pendingId: pending.id });
assert.equal(core.getResume().summary, "new summary");
assert.equal(core.getPendingPatch(), null);

const foreignPending = core.proposeSectionEdit({
  sessionId: "cli-session",
  sectionId: "summary",
  content: "confirmed without matching session"
});
core.hydratePendingPatch(persistence.loadPendingPatch());
core.confirmPendingPatch({ pendingId: foreignPending.id });
assert.equal(core.getResume().summary, "confirmed without matching session");
assert.equal(core.getPendingPatch(), null);

const detailPending = core.proposeSectionEdit({
  sessionId: "session-1",
  sectionId: "experience",
  index: 0,
  field: "details",
  content: "rewritten detail"
});

assert.equal(detailPending.before, "before detail");
core.rejectPendingPatch({ sessionId: "session-1", pendingId: detailPending.id });
assert.equal(core.getPendingPatch(), null);
assert.equal(core.getResume().experience[0].details, "before detail");

core.setResume({
  name: "Test",
  summary: "",
  experience: [{ details: "line one\nline two\nline three" }],
  projects: [{ details: "project one\nproject two" }],
  education: [],
  skills: []
});

const bulletPending = core.proposeSectionEdit({
  sessionId: "session-1",
  sectionId: "experience",
  index: 0,
  field: "details",
  bulletIndex: 1,
  content: "rewritten line two"
});

assert.equal(bulletPending.before, "line two");
assert.equal(bulletPending.after, "rewritten line two");
core.confirmPendingPatch({ sessionId: "session-1", pendingId: bulletPending.id });
assert.equal(core.getResume().experience[0].details, "line one\nrewritten line two\nline three");

const appendBulletPending = core.proposeSectionEdit({
  sessionId: "session-1",
  sectionId: "projects",
  index: 0,
  field: "details",
  bulletIndex: 5,
  content: "project three"
});

assert.equal(appendBulletPending.before, "");
core.confirmPendingPatch({ sessionId: "session-1", pendingId: appendBulletPending.id });
assert.equal(core.getResume().projects[0].details, "project one\nproject two\nproject three");

fs.rmSync(tmp, { recursive: true, force: true });
