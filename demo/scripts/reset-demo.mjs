import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const demoDir = join(scriptDir, "..");
const workspaceDir = join(demoDir, "workspace");
const materialsDir = join(workspaceDir, "materials");
const extractedDir = join(materialsDir, ".extracted");
const historyDir = join(workspaceDir, "history");

const resume = {
  name: "林知远",
  title: "AI 产品经理实习生 / Agent Workflow / 可实习 3-6 个月",
  contact: "demo@resumestudio.local | 138-0000-0000 | 上海",
  avatar: null,
  summary:
    "关注 AI 工作流产品设计，擅长把用户材料、终端 agent 与人工审核流程串联成可解释、可回退的产品体验。",
  education: [
    {
      school: "江城大学",
      tag: "Project Demo",
      major: "信息管理与信息系统",
      degree: "本科",
      date: "2022.09 - 2026.06"
    }
  ],
  skills: [
    {
      category: "Product",
      content: "需求拆解、用户访谈、流程设计、PRD、Figma、指标复盘"
    },
    {
      category: "AI Workflow",
      content: "MCP、prompt evaluation、case library、human-in-the-loop review"
    }
  ],
  experience: [
    {
      company: "Northstar AI Tools",
      role: "AI 产品实习生",
      date: "2025.01 - 2025.06",
      details:
        "参与 AI 表格公式推荐功能评估，整理 120+ 真实用户 Query，构建 case 标签和验收记录，帮助团队定位模型输出不稳定、用户表达模糊和结果采纳断点。"
    }
  ],
  projects: [
    {
      name: "Resume Studio",
      role: "独立开发 / 产品设计",
      date: "2026.05 - 2026.06",
      details:
        "搭建本地优先简历编辑工作台，连接 Electron 桌面端、React A4 预览、本地 bridge、MCP server、pending patch、history 与 PDF export。"
    }
  ],
  fieldStyles: {}
};

const material = `# AI 表格公式推荐项目材料

## 背景

团队正在开发一个 AI 表格公式推荐功能，希望用户用自然语言描述目标后，系统能生成可执行公式。

## 你的工作

- 收集并清洗 120+ 条真实 Query，按意图清晰度、数据范围、公式类型和失败原因建立标签。
- 设计人工验收记录，区分「公式正确」「需要补充上下文」「不可执行」「用户目标不明确」。
- 与研发同步 case 复现路径，把高频失败样例沉淀为回归测试集。

## 可写进简历的结果

- 建立 AI 输出质量评估表，帮助团队更快定位公式推荐失败原因。
- 将模糊自然语言 Query 转成结构化验收字段，提升产品迭代讨论效率。
- 形成 human-reviewed workflow：AI 可以生成结果，但必须经过人工审核和记录后进入正式方案。
`;

const extractedIndex = `# Extracted Materials Index

- [formula-recommendation-notes.md](./formula-recommendation-notes.md)
`;

await rm(workspaceDir, { recursive: true, force: true });
await mkdir(extractedDir, { recursive: true });
await mkdir(historyDir, { recursive: true });
await writeFile(join(workspaceDir, "active-resume.json"), JSON.stringify(resume, null, 2), "utf8");
await writeFile(join(workspaceDir, "pending-patch.json"), "", "utf8");
await writeFile(join(workspaceDir, "activity-log.ndjson"), "", "utf8");
await writeFile(
  join(workspaceDir, "activity-state.json"),
  JSON.stringify({ status: "ready", lastCommand: "demo workspace reset", updatedAt: new Date().toISOString() }, null, 2),
  "utf8"
);
await writeFile(join(materialsDir, "formula-recommendation-notes.md"), material, "utf8");
await writeFile(join(extractedDir, "formula-recommendation-notes.md"), material, "utf8");
await writeFile(join(extractedDir, "index.md"), extractedIndex, "utf8");
await writeFile(join(materialsDir, ".gitkeep"), "", "utf8");

console.log(`Demo workspace reset: ${workspaceDir}`);
