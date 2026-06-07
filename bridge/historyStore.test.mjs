import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "resume-history-"));
process.env.WORKSPACE_DIR = tmp;

const store = await import(`./fileStore.js?history-test=${Date.now()}`);

assert.equal(typeof store.writeActiveResume, "function");
assert.equal(typeof store.readActiveResume, "function");
assert.equal(typeof store.createResumeArchive, "function");
assert.equal(typeof store.listResumeArchives, "function");
assert.equal(typeof store.createNewResumeFromTemplate, "function");
assert.equal(typeof store.restoreResumeArchive, "function");

const originalResume = {
  name: "测试用户",
  title: "AI 产品经理",
  contact: "test@example.com",
  avatar: null,
  summary: "原始总结",
  education: [],
  skills: [],
  experience: [{ company: "A", role: "PM", date: "2026", details: "原始经历" }],
  projects: []
};

await store.writeActiveResume(originalResume);

const archive = await store.createResumeArchive("manual-checkpoint");
assert.equal(archive.reason, "manual-checkpoint");
assert.ok(archive.fileName.endsWith(".json"));
assert.ok(fs.existsSync(archive.fullPath));

let archives = await store.listResumeArchives();
assert.equal(archives.length, 1);
assert.equal(archives[0].reason, "manual-checkpoint");
assert.equal(archives[0].resume.name, "测试用户");

const created = await store.createNewResumeFromTemplate("reset-for-new-role");
assert.equal(created.archived.reason, "reset-for-new-role");
assert.equal(created.resume.name, "Your Name");
assert.equal(created.resume.experience[0].company, "Company Name");

const currentAfterReset = await store.readActiveResume();
assert.equal(currentAfterReset.name, "Your Name");

archives = await store.listResumeArchives();
assert.equal(archives.length, 2);

const restored = await store.restoreResumeArchive(archive.fileName);
assert.equal(restored.resume.name, "测试用户");
assert.equal(restored.resume.experience[0].details, "原始经历");

const currentAfterRestore = await store.readActiveResume();
assert.equal(currentAfterRestore.name, "测试用户");

fs.rmSync(tmp, { recursive: true, force: true });
