import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const DISCOVERY_PATH = path.join(os.homedir(), ".resume-studio", "runtime.json");

// The bridge no longer accepts unauthenticated requests, so the dev proxy has to
// present the same credential the CLI uses. It is read per request rather than at
// config load time, because the bridge is usually started after `vite` and
// regenerates its token on every launch.
function readBridgeRuntime() {
  try {
    const raw = fs.readFileSync(DISCOVERY_PATH, "utf8");
    const info = JSON.parse(raw);
    return info && info.port ? info : null;
  } catch {
    return null;
  }
}

export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${process.env.RESUME_BRIDGE_PORT || 4318}`,
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            const token = process.env.RESUME_BRIDGE_TOKEN || readBridgeRuntime()?.token;
            if (token) proxyReq.setHeader("x-resume-studio-token", token);
          });
        }
      }
    }
  }
});
