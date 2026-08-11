#!/usr/bin/env node

/**
 * Resume CLI — lightweight HTTP client that talks to the running bridge server.
 * Requires the desktop APP or `npm run dev:bridge` to be running.
 *
 * Usage:
 *   resume show                              # Print current resume JSON
 *   resume context                           # Print APP context (selected section, document state)
 *   resume edit <section> [opts] <content>   # Stage a pending patch (APP shows confirm banner)
 *   resume pending                           # Show current pending patch
 *   resume health                            # Check bridge connectivity
 *   resume ingest                            # Extract materials (local, no bridge needed)
 */

const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

// Auto-discovery: the bridge writes ~/.resume-studio/runtime.json on startup
// with its port, token, and workspace. This lets the CLI connect to whichever
// instance is actually running (dev server or packaged desktop APP) instead of
// guessing a port or reading the wrong workspace.
const DISCOVERY_PATH = path.join(os.homedir(), ".resume-studio", "runtime.json");

function readDiscovery() {
  try {
    const raw = fs.readFileSync(DISCOVERY_PATH, "utf8");
    const info = JSON.parse(raw);
    if (info && info.port) return info;
  } catch {
    // No discovery file — fall through to env/default.
  }
  return null;
}

const discovered = readDiscovery();

const BRIDGE_PORT = Number(
  process.env.RESUME_BRIDGE_PORT || discovered?.port || 4318
);
const BRIDGE_HOST = process.env.RESUME_BRIDGE_HOST || "127.0.0.1";
const BRIDGE_TOKEN = process.env.RESUME_BRIDGE_TOKEN || discovered?.token || "";
const BASE_URL = `http://${BRIDGE_HOST}:${BRIDGE_PORT}`;

function authHeaders() {
  return BRIDGE_TOKEN ? { "x-resume-studio-token": BRIDGE_TOKEN } : {};
}

// ---- HTTP helpers ----

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const payload = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { "Content-Type": "application/json", ...authHeaders() },
      timeout: 5000
    };
    const req = http.request(opts, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    req.on("error", (err) => reject(err));
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
    if (payload) req.write(payload);
    req.end();
  });
}

// NDJSON streaming request — collects all lines until connection closes
function requestStream(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const payload = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { "Content-Type": "application/json", ...authHeaders() },
      timeout: 30000
    };
    const req = http.request(opts, (res) => {
      const lines = [];
      let buf = "";
      res.on("data", (chunk) => {
        buf += chunk;
        const parts = buf.split("\n");
        buf = parts.pop();
        for (const line of parts) {
          if (line.trim()) {
            try { lines.push(JSON.parse(line)); } catch { lines.push(line); }
            // Print progress
            try {
              const parsed = JSON.parse(line);
              if (parsed.type === "activity") {
                process.stderr.write(`[${parsed.payload.state}] ${parsed.payload.text || parsed.payload.label}\n`);
              }
            } catch { /* skip */ }
          }
        }
      });
      res.on("end", () => {
        if (buf.trim()) {
          try { lines.push(JSON.parse(buf)); } catch { lines.push(buf); }
        }
        resolve({ status: res.statusCode, lines });
      });
    });
    req.on("error", (err) => reject(err));
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
    if (payload) req.write(payload);
    req.end();
  });
}

async function ensureBridge() {
  try {
    const { status } = await request("GET", "/api/health");
    if (status !== 200) throw new Error();
  } catch {
    process.stderr.write(
      `❌ 无法连接 Resume Studio (${BASE_URL})。\n` +
        (discovered
          ? `发现文件指向 port ${discovered.port}，但该实例已不在运行。\n`
          : `未找到运行中的实例 (${DISCOVERY_PATH} 不存在)。\n`) +
        `请先启动桌面 APP 或运行: npm run dev:bridge\n`
    );
    process.exit(1);
  }
}

// ---- Commands ----

async function cmdShow() {
  await ensureBridge();
  const { data } = await request("GET", "/api/resume/active");
  process.stdout.write(JSON.stringify(data.resume, null, 2) + "\n");
}

async function cmdContext() {
  await ensureBridge();
  const { data } = await request("GET", "/api/context");
  process.stdout.write(JSON.stringify(data.context, null, 2) + "\n");
}

async function cmdHealth() {
  process.stdout.write(`连接目标: ${BASE_URL}\n`);
  process.stdout.write(
    `发现方式: ${
      process.env.RESUME_BRIDGE_PORT
        ? "环境变量 RESUME_BRIDGE_PORT"
        : discovered
          ? DISCOVERY_PATH
          : "默认端口 4318"
    }\n`
  );
  if (discovered?.workspaceDir) {
    process.stdout.write(`Workspace: ${discovered.workspaceDir}\n`);
  }
  process.stdout.write("---\n");
  try {
    const { status, data } = await request("GET", "/api/health");
    process.stdout.write(JSON.stringify(data, null, 2) + "\n");
    process.exit(status === 200 ? 0 : 1);
  } catch (err) {
    process.stderr.write(`❌ 无法连接 bridge: ${err.message}\n`);
    process.exit(1);
  }
}

async function cmdPending() {
  await ensureBridge();
  const { data } = await request("GET", "/api/patch/pending");
  if (!data || !data.pending) {
    process.stdout.write("无待确认的 patch\n");
  } else {
    process.stdout.write(JSON.stringify(data.pending, null, 2) + "\n");
  }
}

async function cmdEdit(args) {
  await ensureBridge();

  // Parse: resume edit <section> [--index N] [--field F] [--bullet N] <content...>
  const section = args.shift();
  if (!section) {
    process.stderr.write("Usage: resume edit <section> [--index N] [--field F] <content>\n");
    process.stderr.write("Sections: name, title, contact, summary, experience, projects, education, skills\n");
    process.exit(1);
  }

  let index = 0;
  let field = undefined;
  let bulletIndex = undefined;
  const contentParts = [];

  while (args.length) {
    const arg = args.shift();
    if (arg === "--index" || arg === "-i") {
      index = parseInt(args.shift(), 10);
    } else if (arg === "--field" || arg === "-f") {
      field = args.shift();
    } else if (arg === "--bullet" || arg === "-b") {
      bulletIndex = parseInt(args.shift(), 10);
    } else {
      contentParts.push(arg);
    }
  }

  const content = contentParts.join(" ").trim();
  if (!content) {
    process.stderr.write("Error: content 不能为空\n");
    process.exit(1);
  }

  const patch = { sectionId: section, index, after: content };
  if (field) patch.field = field;
  if (bulletIndex !== undefined) patch.bulletIndex = bulletIndex;

  const { status, lines } = await requestStream("POST", "/api/patch/propose", {
    patch
  });

  // Find the pending result
  const pendingLine = lines.find((l) => l.type === "pending");
  const doneLine = lines.find((l) => l.type === "done");

  if (pendingLine) {
    process.stdout.write(`✅ Patch 已提交，等待 APP 确认\n`);
    process.stdout.write(`   Section: ${section}\n`);
    process.stdout.write(`   Pending ID: ${pendingLine.payload?.id || "unknown"}\n`);
  } else if (doneLine) {
    process.stdout.write(`✅ 完成\n`);
  } else {
    process.stderr.write(`⚠️  未收到预期响应 (status ${status})\n`);
    process.exit(1);
  }
}

async function cmdIngest() {
  // Ingest is local-only, doesn't need bridge
  const { run } = require("./ingest.cjs");
  const result = await run();
  process.stdout.write(`Ingest done: ${result.ok} extracted, ${result.skipped} skipped.\n`);
}

// ---- Main ----

const [, , command = "help", ...args] = process.argv;

async function main() {
  try {
    switch (command) {
      case "show": return await cmdShow();
      case "context": return await cmdContext();
      case "health": return await cmdHealth();
      case "pending": return await cmdPending();
      case "edit": return await cmdEdit([...args]);
      case "ingest": return await cmdIngest();
      case "help":
      default:
        process.stdout.write(`resume-cli — 与 Resume Studio 桌面 APP 实时联动的命令行工具

Commands:
  show                                   打印当前简历 JSON
  context                                打印 APP 当前状态（选中 section 等）
  edit <section> [--index N] [--field F] <content>
                                         提交修改建议，APP 弹出确认
  pending                                查看当前待确认 patch
  health                                 检查 bridge 连接状态
  ingest                                 扫描 materials/ 提取文档

Sections: name, title, contact, summary, experience, projects, education, skills

Examples:
  resume show
  resume edit title "AI 产品经理"
  resume edit experience --index 0 --field details "新的经历描述"
  resume context

需要 Resume Studio 桌面 APP 或 dev:bridge 正在运行。
`);
    }
  } catch (err) {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(1);
  }
}

main();
