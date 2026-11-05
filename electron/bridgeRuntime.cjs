const crypto = require("node:crypto");
const net = require("node:net");
const path = require("node:path");

function canListen(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    // exclusive so a port another process holds with SO_REUSEADDR is reported as
    // taken rather than probing clean and then failing at the real listen.
    server.listen({ port, host: "127.0.0.1", exclusive: true });
  });
}

async function findAvailablePort(preferredPort = 4318, attempts = 100) {
  for (let i = 0; i < attempts; i += 1) {
    const port = preferredPort + i;
    if (await canListen(port)) return port;
  }
  throw new Error(`No available bridge port found from ${preferredPort}`);
}

async function configureBridgeRuntime({
  isDev,
  workspacePath,
  resourcesPath,
  env = process.env,
  preferredPort = 4318,
  findPort = findAvailablePort
}) {
  const port = await findPort(preferredPort);
  const token = crypto.randomBytes(32).toString("hex");
  const bridgeBinDir = isDev
    ? path.join(__dirname, "..", "bridge", "bin")
    : path.join(resourcesPath, "bridge", "bin");
  const bridgeServerPath = isDev
    ? path.join(__dirname, "..", "bridge", "server.js")
    : path.join(resourcesPath, "bridge", "server.js");

  env.WORKSPACE_DIR = workspacePath;
  env.RESUME_BRIDGE_PORT = String(port);
  env.RESUME_BRIDGE_TOKEN = token;
  env.RESUME_BRIDGE_URL = `http://127.0.0.1:${port}`;
  env.RESUME_BRIDGE_BIN_DIR = bridgeBinDir;

  return {
    bridgeBaseUrl: env.RESUME_BRIDGE_URL,
    bridgeToken: token,
    bridgeBinDir,
    bridgeServerPath,
    port
  };
}

module.exports = {
  configureBridgeRuntime,
  findAvailablePort
};
