import { spawn } from "node:child_process";
import { cp, lstat, readdir, rm, stat, symlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const builtAppPath = path.join(repoRoot, "release", "mac-arm64", "Resume Studio.app");
const installedAppPath = "/Applications/Resume Studio.app";
const electronAppPath = path.join(repoRoot, "node_modules", "electron", "dist", "Electron.app");

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

async function exists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function repairFrameworkSymlinks(appPath) {
  const frameworksPath = path.join(appPath, "Contents", "Frameworks");
  if (!(await exists(frameworksPath))) return;

  for (const entry of await readdir(frameworksPath)) {
    if (!entry.endsWith(".framework")) continue;

    const frameworkPath = path.join(frameworksPath, entry);
    const versionAPath = path.join(frameworkPath, "Versions", "A");
    if (!(await exists(versionAPath))) continue;

    const currentPath = path.join(frameworkPath, "Versions", "Current");
    await rm(currentPath, { force: true });
    await symlink("A", currentPath);

    for (const child of await readdir(versionAPath)) {
      const topLevelPath = path.join(frameworkPath, child);
      try {
        const topLevelStat = await lstat(topLevelPath);
        if (!topLevelStat.isSymbolicLink()) continue;
        await rm(topLevelPath, { force: true });
      } catch {
        // Missing top-level framework symlink; recreate it below.
      }
      await symlink(path.join("Versions", "Current", child), topLevelPath);
    }
  }
}

if (await exists(electronAppPath)) {
  await run("xattr", ["-cr", electronAppPath]);
}

await run("npm", ["run", "build:desktop"], {
  env: {
    ...process.env,
    CSC_IDENTITY_AUTO_DISCOVERY: "false"
  }
});

await stat(builtAppPath);

try {
  await run("killall", ["Resume Studio"]);
} catch {
  // App may not be running.
}

await rm(installedAppPath, { recursive: true, force: true });
await cp(builtAppPath, installedAppPath, { recursive: true });
await repairFrameworkSymlinks(installedAppPath);
await rm(builtAppPath, { recursive: true, force: true });

console.log(`Installed ${installedAppPath}`);
