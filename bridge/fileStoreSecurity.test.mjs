import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "resume-store-security-"));
process.env.WORKSPACE_DIR = tmp;

const parentSecret = path.join(path.dirname(tmp), "secret.rts.json");
fs.writeFileSync(
  parentSecret,
  JSON.stringify({
    version: 1,
    meta: { title: "outside" },
    resume: { name: "outside-file", summary: "" }
  }),
  "utf8"
);

const store = await import(`./fileStore.js?security-test=${Date.now()}`);

await assert.rejects(
  () => store.openResumeDocument("../secret.rts.json"),
  /Invalid resume document file name/
);

await assert.rejects(
  () => store.restoreResumeArchive("../secret.rts.json"),
  /Invalid archive file name/
);

fs.rmSync(tmp, { recursive: true, force: true });
fs.rmSync(parentSecret, { force: true });
