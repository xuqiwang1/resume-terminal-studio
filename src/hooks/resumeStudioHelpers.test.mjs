import assert from "node:assert/strict";
import {
  formatFieldPathLabel,
  formatPendingChangeFields,
  formatPendingChangeLabel,
  formatPendingValue,
  formatSelectionSummary,
  getPendingPatchPrimarySection,
  normalizePendingSection,
  patchFieldId,
  sectionIdFromFieldId
} from "./resumeStudioHelpers.js";

assert.equal(sectionIdFromFieldId("header.name"), "header");
assert.equal(sectionIdFromFieldId("summary.text"), "summary");

assert.equal(normalizePendingSection("name"), "header");
assert.equal(normalizePendingSection("title"), "header");
assert.equal(normalizePendingSection("contact"), "header");
assert.equal(normalizePendingSection("skills"), "skills");

assert.equal(patchFieldId("name"), "header.name");
assert.equal(patchFieldId("title"), "header.title");
assert.equal(patchFieldId("contact"), "header.contact");

assert.equal(formatFieldPathLabel("education.0.date"), "教育背景 / 第 1 条 / 时间");
assert.equal(formatFieldPathLabel("projects.1.role"), "项目经历 / 第 2 条 / 角色");
assert.equal(formatFieldPathLabel("header.name"), "页眉 / 姓名");
assert.equal(formatFieldPathLabel("summary.text"), "个人总结 / 正文");

assert.deepEqual(formatSelectionSummary({ selectedField: "projects.1.role" }), {
  title: "当前选中：项目经历 / 第 2 条 / 角色",
  description: "可调整选中字段的字体和颜色。"
});

assert.equal(
  formatPendingChangeLabel({
    operation: "replace_item",
    sectionId: "projects",
    index: 1
  }),
  "替换项目经历第 2 条"
);

assert.equal(
  formatPendingChangeLabel({
    operation: "replace_field",
    sectionId: "education",
    index: 0,
    field: "date"
  }),
  "修改教育经历第 1 条 / 时间"
);

assert.deepEqual(
  formatPendingChangeFields({
    sectionId: "projects",
    after: { name: "Resume Studio", role: "产品负责人", details: "本地简历编辑原型。" }
  }),
  ["项目名称", "角色", "项目描述"]
);

assert.deepEqual(
  formatPendingValue(
    { name: "Resume Studio", role: "产品负责人", details: "本地简历编辑原型。" },
    "projects"
  ),
  [
    { label: "项目名称", text: "Resume Studio" },
    { label: "角色", text: "产品负责人" },
    { label: "项目描述", text: "本地简历编辑原型。" }
  ]
);

assert.equal(
  getPendingPatchPrimarySection({
    kind: "single",
    sectionId: "title"
  }),
  "header"
);

assert.equal(
  getPendingPatchPrimarySection({
    kind: "batch",
    changes: [{ operation: "replace_section", sectionId: "contact", after: "x" }]
  }),
  "header"
);

console.log("All resumeStudioHelpers checks passed.");
