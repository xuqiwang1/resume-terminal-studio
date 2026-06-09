import { spawn } from "node:child_process";
import { cp, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const builtAppPath = path.join(repoRoot, "release", "mac-arm64", "Resume Studio.app");
const installedAppPath = "/Applications/Resume Studio.app";

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: "inherit",
      shell: false,
      ...options
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code}`));
    });
    child.on("error", reject);
  });
}

await run("npm", ["run", "build:desktop"]);

await stat(builtAppPath);

try {
  await run("killall", ["Resume Studio"]);
} catch {
  // App may not be running.
}

await rm(installedAppPath, { recursive: true, force: true });
await cp(builtAppPath, installedAppPath, { recursive: true });
await rm(builtAppPath, { recursive: true, force: true });

console.log(`Installed ${installedAppPath}`);
