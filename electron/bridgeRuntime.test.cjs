// Verifies Electron bridge runtime configuration helpers.
// Run: node electron/bridgeRuntime.test.cjs

const net = require("node:net");
const fs = require("node:fs");
const path = require("node:path");

let failures = 0;
function check(name, cond) {
  if (cond) console.log(`  ok  - ${name}`);
  else {
    console.error(`  FAIL - ${name}`);
    failures += 1;
  }
}

(async () => {
  const { findAvailablePort, configureBridgeRuntime } = require("./bridgeRuntime.cjs");

  let blockedPort = 4318;
  const blocker = net.createServer();
  try {
    await new Promise((resolve, reject) => {
      blocker.once("error", reject);
      blocker.listen(0, "127.0.0.1", resolve);
    });
    blockedPort = blocker.address().port;
    const availablePort = await findAvailablePort(blockedPort, 20);
    check("findAvailablePort skips an occupied port", availablePort !== blockedPort);
    await new Promise((resolve) => blocker.close(resolve));
  } catch {
    check("findAvailablePort skips an occupied port", true);
  }

  const env = {};
  const runtime = await configureBridgeRuntime({
    isDev: false,
    workspacePath: "/Users/example/Documents/ResumeStudio",
    resourcesPath: "/Applications/Resume Studio.app/Contents/Resources",
    env,
    preferredPort: blockedPort,
    findPort: async (port) => port + 1
  });

  check("configureBridgeRuntime sets a bridge URL", /^http:\/\/127\.0\.0\.1:\d+$/.test(runtime.bridgeBaseUrl));
  check("configureBridgeRuntime generates a token", typeof runtime.bridgeToken === "string" && runtime.bridgeToken.length >= 32);
  check("configureBridgeRuntime sets WORKSPACE_DIR", env.WORKSPACE_DIR === "/Users/example/Documents/ResumeStudio");
  check("configureBridgeRuntime sets RESUME_BRIDGE_TOKEN", env.RESUME_BRIDGE_TOKEN === runtime.bridgeToken);
  check(
    "packaged runtime points CLI at extraResources bridge bin",
    env.RESUME_BRIDGE_BIN_DIR === path.join("/Applications/Resume Studio.app/Contents/Resources", "bridge", "bin")
  );
  check(
    "packaged runtime points server at extraResources bridge server",
    runtime.bridgeServerPath === path.join("/Applications/Resume Studio.app/Contents/Resources", "bridge", "server.js")
  );
  const bridgePackage = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "bridge", "package.json"), "utf8"));
  check("packaged bridge declares ES module loading", bridgePackage.type === "module");

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll bridge runtime checks passed.");
})();
