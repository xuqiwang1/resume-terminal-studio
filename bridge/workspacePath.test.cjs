const assert = require("node:assert/strict");
const path = require("node:path");
const { resolveWorkspaceDir } = require("./workspacePath.cjs");

const custom = resolveWorkspaceDir({ WORKSPACE_DIR: "custom-workspace" }, "/tmp/app/bridge");
assert.equal(custom, path.resolve("custom-workspace"));

const dev = resolveWorkspaceDir({}, path.join("/Users/example/project", "bridge"));
assert.equal(dev, path.join("/Users/example/project", "workspace"));

const packaged = resolveWorkspaceDir(
  {},
  path.join("/Applications/Resume Studio.app", "Contents", "Resources", "bridge")
);
assert.equal(packaged, path.join(require("node:os").homedir(), "Documents", "ResumeStudio"));

console.log("All workspace path checks passed.");
