import assert from "node:assert/strict";
import { mergeResumeSnapshot } from "./resumeSnapshotMerge.js";

const current = {
  name: "许起旺",
  title: "AI 产品经理 | 一周内到岗 | 可实习 3-6 个月",
  contact: "15298902501 | 2509617962@qq.com | 作品集：https://xuqiwang.me",
  summary: "old summary",
  projects: [
    { name: "Build as Writing", role: "｜ https://github.com/xuqiwang1/resume-terminal-studio", date: "", details: "old" }
  ],
  avatar: "data:image/png;base64,avatar",
  avatarPos: { x: 12, y: -4 },
  fieldStyles: {
    "projects.0.role": { color: "#0645ad", underline: true }
  },
  layoutConfig: {
    linkStyle: { mode: "default", color: "#0645ad", underline: true }
  }
};

{
  const incoming = {
    ...current,
    summary: "new summary from external patch",
    avatar: null
  };
  const merged = mergeResumeSnapshot(current, incoming);
  assert.equal(merged.summary, "new summary from external patch");
  assert.equal(merged.avatar, current.avatar);
}

{
  const incoming = {
    ...current,
    title: "AI 产品经理",
  };
  delete incoming.avatar;
  delete incoming.avatarPos;
  delete incoming.fieldStyles;
  delete incoming.layoutConfig;

  const merged = mergeResumeSnapshot(current, incoming);
  assert.equal(merged.title, "AI 产品经理");
  assert.equal(merged.avatar, current.avatar);
  assert.deepEqual(merged.avatarPos, current.avatarPos);
  assert.deepEqual(merged.fieldStyles, current.fieldStyles);
  assert.deepEqual(merged.layoutConfig, current.layoutConfig);
}

{
  const incoming = {
    ...current,
    fieldStyles: {
      "contact.text": { color: "#111111" }
    },
    layoutConfig: {
      linkStyle: { mode: "custom", color: "#000000", underline: false }
    }
  };
  const merged = mergeResumeSnapshot(current, incoming);
  assert.deepEqual(merged.fieldStyles, incoming.fieldStyles);
  assert.deepEqual(merged.layoutConfig, incoming.layoutConfig);
}

{
  const merged = mergeResumeSnapshot(null, { name: "Only Incoming", avatar: null });
  assert.deepEqual(merged, { name: "Only Incoming", avatar: null });
}

console.log("resumeSnapshotMerge tests passed");
