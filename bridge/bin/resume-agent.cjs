#!/usr/bin/env node

const {
  activeResumePath,
  endCommandSession,
  loadResume,
  proposeEdit,
  startCommandSession
} = require("./resume-engine.cjs");

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
    switch (command) {
      case "show": {
        writeStdout(JSON.stringify(loadResume(), null, 2));
        break;
      }
      case "title": {
        const value = args.join(" ").trim();
        ensureValue(value, "Usage: resume-agent title 新的职位标题");
        const { pending } = proposeEdit({ sectionId: "title", content: value }, sessionId);
        writeStdout(`Staged title patch ${pending.id}. Accept or reject it in the Resume Studio app.`);
        break;
      }
      case "contact": {
        const value = args.join(" ").trim();
        ensureValue(value, "Usage: resume-agent contact 新的联系方式");
        const { pending } = proposeEdit({ sectionId: "contact", content: value }, sessionId);
        writeStdout(`Staged contact patch ${pending.id}. Accept or reject it in the Resume Studio app.`);
        break;
      }
      case "summary":
      case "experience":
      case "project": {
        throw new Error(
          "Direct content editing has been removed. Ask your terminal AI agent to read materials/.extracted/ and submit via MCP propose_edit or propose_batch_edit."
        );
      }
      case "ask": {
        throw new Error(
          'resume-agent ask 已移除。请让你的终端 AI agent（Codex/Claude）读取 materials/.extracted/，自己写好文案后通过 MCP 工具 propose_edit 或 propose_batch_edit 提交。'
        );
      }
      case "ingest": {
        const { run } = require("./ingest.cjs");
        const result = await run();
        writeStdout(`Ingest done: ${result.ok} extracted, ${result.skipped} skipped.`);
        break;
      }
      case "confirm": {
        throw new Error("resume-agent confirm 已禁用。请在 Resume Studio 工作台点击「接受」，避免 agent 通过 Bash 绕过用户审核。");
      }
      case "reject": {
        throw new Error("resume-agent reject 已禁用。请在 Resume Studio 工作台点击「拒绝」，避免 agent 通过 Bash 绕过用户审核。");
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
  title 新标题                            # 暂存标题改动，需在 APP 接受
  contact 新联系方式                      # 暂存联系方式改动，需在 APP 接受

注：正文改写由你的终端 AI agent 读取 materials/.extracted/ 后，通过 MCP 工具 propose_edit 或 propose_batch_edit 提交。
注：接受/拒绝只能在工作台界面操作，避免 agent 绕过用户确认。
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
