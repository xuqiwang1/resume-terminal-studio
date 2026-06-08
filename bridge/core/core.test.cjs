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

assert.equal(pending.kind, "single");
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

core.setResume({
  name: "Test",
  summary: "",
  experience: [{ details: "existing detail" }],
  projects: [],
  education: [],
  skills: []
});

assert.throws(
  () =>
    core.proposeSectionEdit({
      sessionId: "session-1",
      sectionId: "experience",
      index: 9,
      content: "nope"
    }),
  /experience\[9\] does not exist/
);

assert.throws(
  () =>
    core.proposeSectionEdit({
      sessionId: "session-1",
      sectionId: "education",
      index: 0,
      field: "not-a-field",
      content: "nope"
    }),
  /education field "not-a-field" is invalid/
);

const appendStructuredPending = core.proposeSectionEdit({
  sessionId: "session-1",
  sectionId: "education",
  index: 0,
  field: "school",
  content: "新学校"
});

assert.equal(appendStructuredPending.append, true);
core.confirmPendingPatch({ sessionId: "session-1", pendingId: appendStructuredPending.id });
assert.equal(core.getResume().education[0].school, "新学校");

core.setResume({
  name: "Test",
  title: "Old title",
  contact: "Old contact",
  summary: "",
  experience: [],
  projects: [],
  education: [
    {
      school: "School Name",
      degree: "Degree",
      major: "Major",
      date: "Date",
      tag: ""
    }
  ],
  skills: [{ category: "Product", content: "old content" }]
});

const batchPending = core.proposeBatchEdit({
  sessionId: "session-1",
  title: "Fill education",
  summary: "Replace one entry and append one entry",
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
    },
    {
      operation: "append_item",
      sectionId: "education",
      value: {
        school: "安徽大学",
        degree: "本科",
        major: "社会学",
        date: "2020.09 - 2024.06",
        tag: "211"
      }
    }
  ]
});

assert.equal(batchPending.kind, "batch");
assert.equal(batchPending.changes.length, 2);
assert.equal(core.getResume().education.length, 1);

core.confirmPendingPatch({ sessionId: "session-1", pendingId: batchPending.id });
assert.equal(core.getResume().education[0].school, "北京师范大学");
assert.equal(core.getResume().education[1].school, "安徽大学");

core.setResume({
  name: "Test",
  summary: "",
  experience: [],
  projects: [],
  education: [
    {
      school: "北京师范大学",
      degree: "硕士",
      major: "社会学",
      date: "2024.09 - 2027.06",
      tag: "985"
    }
  ],
  skills: [{ category: "Product", content: "old content" }]
});

const rejectedBatch = core.proposeBatchEdit({
  sessionId: "session-1",
  title: "Rewrite summary and skills",
  changes: [
    { operation: "replace_section", sectionId: "summary", value: "new summary" },
    {
      operation: "replace_field",
      sectionId: "skills",
      index: 0,
      field: "content",
      value: "new content"
    }
  ]
});

core.rejectPendingPatch({ sessionId: "session-1", pendingId: rejectedBatch.id });
assert.equal(core.getResume().summary, "");
assert.equal(core.getResume().skills[0].content, "old content");

assert.throws(
  () =>
    core.proposeBatchEdit({
      sessionId: "session-1",
      title: "Bad edit",
      changes: [
        {
          operation: "replace_field",
          sectionId: "education",
          index: 9,
          field: "school",
          value: "x"
        }
      ]
    }),
  /education\[9\] does not exist/
);

fs.rmSync(tmp, { recursive: true, force: true });
