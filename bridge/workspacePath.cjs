const os = require("node:os");
const path = require("node:path");

function isPackagedResourcesBridge(currentDir) {
  return currentDir.includes(`${path.sep}Contents${path.sep}Resources${path.sep}bridge`);
}

function resolveWorkspaceDir(env = process.env, currentDir = __dirname) {
  if (env.WORKSPACE_DIR) return path.resolve(env.WORKSPACE_DIR);
  if (isPackagedResourcesBridge(currentDir)) {
    return path.join(os.homedir(), "Documents", "ResumeStudio");
  }
  return path.resolve(currentDir, "../workspace");
}

module.exports = {
  resolveWorkspaceDir
};
