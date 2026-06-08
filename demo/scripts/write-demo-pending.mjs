import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const defaultWorkspaceDir = join(scriptDir, "..", "workspace");
const workspaceDir = process.env.WORKSPACE_DIR
  ? resolve(process.env.WORKSPACE_DIR)
  : defaultWorkspaceDir;

const activeResumePath = join(workspaceDir, "active-resume.json");
const pendingPatchPath = join(workspaceDir, "pending-patch.json");
const resume = JSON.parse(await readFile(activeResumePath, "utf8"));

const after =
  "独立设计并开发本地优先的 AI 简历编辑工作台，将 Electron 桌面端、React A4 预览、本地 bridge、MCP server 与 pending patch 机制串成闭环；agent 可读取本地材料并提交改写建议，但正文写入必须经过 diff 审核、接受/拒绝和历史归档，验证了 human-reviewed AI writing 的可信交互模式。";

const pending = {
  id: randomUUID(),
  sessionId: "demo-recording-session",
  sectionId: "projects",
  index: 0,
  field: "details",
  before: resume.projects?.[0]?.details || "",
  after
};

await writeFile(pendingPatchPath, JSON.stringify(pending, null, 2), "utf8");
console.log(`Demo pending patch written: ${pendingPatchPath}`);
