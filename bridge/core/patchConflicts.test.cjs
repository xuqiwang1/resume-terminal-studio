// Real behavioral test: detectPendingConflicts is pure, so it can be exercised
// directly instead of grepping source strings.
const assert = require("node:assert/strict");
const { detectPendingConflicts } = require("./resumeCore.cjs");

const resume = {
  name: "Xu",
  title: "AI 产品经理",
  summary: "原始总结",
  experience: [
    { company: "A 公司", role: "实习", details: "第一条\n第二条" },
    { company: "B 公司", role: "实习", details: "另一条" }
  ],
  education: [{ school: "某大学", major: "计算机" }],
  skills: [{ category: "工具", content: "Figma" }]
};

// No pending patch, nothing to conflict with.
assert.deepEqual(detectPendingConflicts(null, resume), []);

// Scalar section, before still matches -> clean.
assert.deepEqual(
  detectPendingConflicts({ kind: "single", sectionId: "summary", before: "原始总结", after: "新总结" }, resume),
  []
);

// Scalar section, before no longer matches -> one conflict carrying both values.
const scalarConflicts = detectPendingConflicts(
  { kind: "single", sectionId: "summary", before: "过时的旧总结", after: "新总结" },
  resume
);
assert.equal(scalarConflicts.length, 1);
assert.equal(scalarConflicts[0].sectionId, "summary");
assert.equal(scalarConflicts[0].expected, "过时的旧总结");
assert.equal(scalarConflicts[0].actual, "原始总结");

// Structured field, matching and mismatching.
assert.deepEqual(
  detectPendingConflicts(
    { kind: "single", sectionId: "experience", index: 1, field: "details", before: "另一条", after: "x" },
    resume
  ),
  []
);
assert.equal(
  detectPendingConflicts(
    { kind: "single", sectionId: "experience", index: 1, field: "details", before: "被改过了", after: "x" },
    resume
  ).length,
  1
);

// A bullet-scoped patch compares only that bullet, not the whole field.
assert.deepEqual(
  detectPendingConflicts(
    { kind: "single", sectionId: "experience", index: 0, field: "details", bulletIndex: 1, before: "第二条", after: "x" },
    resume
  ),
  []
);
const bulletConflicts = detectPendingConflicts(
  { kind: "single", sectionId: "experience", index: 0, field: "details", bulletIndex: 1, before: "第三条", after: "x" },
  resume
);
assert.equal(bulletConflicts.length, 1);
assert.equal(bulletConflicts[0].bulletIndex, 1);
assert.equal(bulletConflicts[0].actual, "第二条");

// Append patches target an item that does not exist yet, so they cannot conflict.
assert.deepEqual(
  detectPendingConflicts(
    { kind: "single", sectionId: "skills", index: 0, field: "content", append: true, before: "", after: "x" },
    resume
  ),
  []
);

// Batch: only the changed rows are reported, and append_item is exempt.
const batchConflicts = detectPendingConflicts(
  {
    kind: "batch",
    changes: [
      { operation: "replace_field", sectionId: "title", before: "AI 产品经理", after: "x" },
      { operation: "replace_field", sectionId: "summary", before: "旧的", after: "y" },
      { operation: "replace_field", sectionId: "education", index: 0, field: "major", before: "已改过", after: "z" },
      { operation: "append_item", sectionId: "projects", before: null, after: { name: "新项目" } }
    ]
  },
  resume
);
assert.equal(batchConflicts.length, 2, "only the two mismatching rows conflict");
assert.deepEqual(
  batchConflicts.map((c) => c.sectionId),
  ["summary", "education"]
);
assert.equal(batchConflicts[1].field, "major");
assert.equal(batchConflicts[1].index, 0);

// replace_item compares whole objects, not strings.
assert.deepEqual(
  detectPendingConflicts(
    {
      kind: "batch",
      changes: [
        {
          operation: "replace_item",
          sectionId: "education",
          index: 0,
          before: { school: "某大学", major: "计算机" },
          after: { school: "某大学", major: "软件工程" }
        }
      ]
    },
    resume
  ),
  [],
  "an identical object is not a conflict"
);
assert.equal(
  detectPendingConflicts(
    {
      kind: "batch",
      changes: [
        {
          operation: "replace_item",
          sectionId: "education",
          index: 0,
          before: { school: "另一所大学", major: "计算机" },
          after: {}
        }
      ]
    },
    resume
  ).length,
  1,
  "a changed object is a conflict"
);

// Missing vs empty string must not be reported as a change.
assert.deepEqual(
  detectPendingConflicts({ kind: "single", sectionId: "summary", before: "", after: "x" }, { summary: undefined }),
  []
);

console.log("All patch conflict checks passed.");
