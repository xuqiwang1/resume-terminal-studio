#!/usr/bin/env node

const {
  activeResumePath,
  endCommandSession,
  loadResume,
  setContact,
  setTitle,
  startCommandSession
} = require("./resume-engine.cjs");
const { initializeRuntime } = require("../core/runtime.cjs");
const { workspaceDir } = require("./resume-engine.cjs");

const [, , command = "help", ...args] = process.argv;
const rawCommand = `resume-agent ${process.argv.slice(2).join(" ")}`.trim();

function ensureValue(value, message) {
  if (!value || !String(value).trim()) {
    throw new Error(message);
  }
}

function writeStdout(text) {
  process.stdout.write(`${text}\n`);
}

async function run() {
  const sessionId = startCommandSession(rawCommand, { command, args });
  try {
    const runtime = initializeRuntime({ workspaceDir, resume: loadResume() });
    switch (command) {
      case "show": {
        writeStdout(JSON.stringify(loadResume(), null, 2));
        break;
      }
      case "title": {
        const value = args.join(" ").trim();
        ensureValue(value, "Usage: resume-agent title 新的职位标题");
        setTitle(value, sessionId);
        writeStdout("Updated title");
        break;
      }
      case "contact": {
        const value = args.join(" ").trim();
        ensureValue(value, "Usage: resume-agent contact 新的联系方式");
        setContact(value, sessionId);
        writeStdout("Updated contact");
        break;
      }
      case "summary":
      case "experience":
      case "project": {
        throw new Error(
          'Direct content editing has been removed. Use: resume-agent ask "把个人总结改得更像 AI 产品经理"'
        );
      }
      case "ask": {
        throw new Error(
          'resume-agent ask 已移除。请让你的终端 AI agent（Codex/Claude）读取 materials/.extracted/，自己写好文案后通过 MCP 工具 propose_edit 提交。'
        );
      }
      case "ingest": {
        const { run } = require("./ingest.cjs");
        const result = await run();
        writeStdout(`Ingest done: ${result.ok} extracted, ${result.skipped} skipped.`);
        break;
      }
      case "confirm": {
        const pending = runtime.core.getPendingPatch();
        ensureValue(pending, "No pending change to confirm.");
        runtime.core.confirmPendingPatch({
          sessionId: pending.sessionId,
          pendingId: pending.id
        });
        writeStdout(`Confirmed -> ${pending.sectionId} written to resume.`);
        break;
      }
      case "reject": {
        const pending = runtime.core.getPendingPatch();
        ensureValue(pending, "No pending change to reject.");
        runtime.core.rejectPendingPatch({
          sessionId: pending.sessionId,
          pendingId: pending.id
        });
        writeStdout("Rejected. Resume unchanged.");
        break;
      }
      case "export-html":
      case "export-pdf": {
        throw new Error(
          "导出已改为「预览即导出」：请在工作台（桌面或浏览器）中导出 PDF，渲染与屏幕预览完全一致。命令行导出已移除。"
        );
      }
      case "help":
      default: {
        writeStdout(`resume-agent commands:
  show
  ingest                                 # 扫描 materials/ 抽取 PDF/Excel/文本给 AI 阅读
  title 新标题
  contact 新联系方式
  confirm                                # 接受待确认改动并写入
  reject                                 # 放弃待确认改动

注：正文改写由你的终端 AI agent 读取 materials/.extracted/ 后，通过 MCP 工具 propose_edit 提交。
注：PDF 导出请在工作台界面中操作（预览即导出，所见即所得）。

active resume: ${activeResumePath}`);
      }
    }
    endCommandSession(sessionId, rawCommand, true);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    endCommandSession(sessionId, rawCommand, false);
    process.exitCode = 1;
  }
}

run();
