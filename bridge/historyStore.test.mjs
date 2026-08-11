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

// The confirm route archives the resume it holds in memory, which may differ from the
// file on disk (unsaved styling). An explicit resume must win over readActiveResume().
const inMemory = { ...originalResume, summary: "仅存在于内存中的总结" };
const fromMemory = await store.createResumeArchive("before-ai-patch", { resume: inMemory });
assert.equal(fromMemory.resume.summary, "仅存在于内存中的总结");
const reread = await store.listResumeArchives();
assert.equal(
  reread.find((a) => a.fileName === fromMemory.fileName).resume.summary,
  "仅存在于内存中的总结"
);
assert.equal((await store.readActiveResume()).summary, "原始总结", "archiving must not write the active resume");

// Two archives in the same millisecond used to collide on one filename, so the second
// silently replaced the first. Accepting several patches quickly makes that reachable.
const burst = await Promise.all([
  store.createResumeArchive("before-ai-patch", { resume: originalResume }),
  store.createResumeArchive("before-ai-patch", { resume: originalResume }),
  store.createResumeArchive("before-ai-patch", { resume: originalResume })
]);
assert.equal(new Set(burst.map((a) => a.fileName)).size, 3, "burst archives must not overwrite each other");

// Auto checkpoints are capped; manual snapshots are never pruned.
const beforePrune = await store.listResumeArchives();
const manualCount = beforePrune.filter((a) => a.reason !== store.AUTO_ARCHIVE_REASON).length;
for (let i = 0; i < 45; i += 1) {
  await store.createResumeArchive(store.AUTO_ARCHIVE_REASON, { resume: originalResume, prune: true });
}
const afterPrune = await store.listResumeArchives();
const autoAfter = afterPrune.filter((a) => a.reason === store.AUTO_ARCHIVE_REASON);
assert.ok(autoAfter.length <= 40, `auto checkpoints must stay capped, got ${autoAfter.length}`);
assert.equal(
  afterPrune.filter((a) => a.reason !== store.AUTO_ARCHIVE_REASON).length,
  manualCount,
  "pruning must not touch manual snapshots"
);

fs.rmSync(tmp, { recursive: true, force: true });
console.log("All history store checks passed.");
