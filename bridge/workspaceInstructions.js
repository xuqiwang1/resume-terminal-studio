export function getAgentGuideContent() {
  return `# Resume Studio Agent Guide

You are running inside the local workspace of **Resume Studio** (终端简历编辑器).
The user is viewing a live-rendered GUI preview of their resume on the left side of their screen.

## What you can READ freely

- \`materials/.extracted/*.md\` — the user's real source material (internship docs,
  project notes, spreadsheets) already extracted into clean markdown. Start from
  \`materials/.extracted/index.md\`. If it is empty, ask the user to run \`resume-agent ingest\`.
- The user's project files / code in this workspace.
- \`active-resume.json\` — the current resume (READ ONLY, see below).

## How to WRITE to the resume (strict)

The resume is the user's asset. You MUST NOT modify it silently.

- **Do NOT edit \`active-resume.json\` directly.** Even though you can write files,
  writing this file is forbidden — it would bypass the user's review.
- To change resume text (title / contact / summary / experience / projects / education / skills),
  first READ the materials and WRITE the finished text yourself, then submit it
  through MCP:
  - Use **\`propose_edit({ sectionId, index, field, content })\`** for one narrow edit.
  - Use **\`propose_batch_edit({ title, summary, changes })\`** for one coherent multi-field
    or multi-item task, such as filling education or rewriting one whole project entry.
  - \`title\` / \`contact\` / \`summary\`: plain text, no index/field.
  - \`experience\` / \`projects\`: arrays; use \`index\` + default field \`details\`.
  - \`education\`: array of { school, degree, major, date, tag }; use \`index\` + \`field\`
    (one of school/degree/major/date/tag).
  - \`skills\`: array of { category, content }; use \`index\` + \`field\` (category/content).
- MCP proposals stage a PENDING change. They do not take effect until the user
  clicks 「接受」 in the workbench. They may also reject them.
- Do NOT run \`resume-agent confirm\` or \`resume-agent reject\`; those commands are disabled
  so agents cannot bypass user approval through Bash.
- Do NOT quit, kill, reopen, rebuild, unpack, or patch the Resume Studio app unless
  the user explicitly asks for app development work. Resume content edits do not
  require touching the application bundle.
- The avatar is uploaded by the user in the workbench — do NOT try to set it.

## Recommended flow

1. Read \`materials/.extracted/index.md\` and the relevant extracted files.
2. Call MCP \`get_context\` to understand the current APP document, visible page, and selected field.
3. Understand what the user actually did; draft strong, outcome-oriented copy.
4. Use \`propose_edit\` for one narrow edit, or \`propose_batch_edit\` for one coherent batch task.
5. Wait for the user to accept or reject in the workbench.
`;
}

export function getWorkspaceReadmeContent() {
  return `# Resume Studio 工作区指南 (Agent Context)

欢迎来到 **Resume Studio** 本地工作台！

作为 AI 智能体（如 Codex, Antigravity, Claude Code），你正在通过终端访问用户的简历工作区。

## 你可以自由「读」

1. \`materials/.extracted/*.md\`：用户真实素材（实习文档、项目笔记、表格）已被抽取成干净的
   markdown。从 \`materials/.extracted/index.md\` 开始读。若为空，请提醒用户先运行
   \`resume-agent ingest\`。
2. 工作区里的项目文件 / 代码。
3. \`active-resume.json\`：当前简历内容（**只读**，见下）。

## 你「写」简历必须遵守（重要）

简历是用户的资产，**不允许在用户不知情时被改动**。

1. **禁止直接修改 \`active-resume.json\`**。即使你有文件写入能力，也不能写这个文件——那会绕过用户的审核。
2. 要修改简历文本（title / contact / summary / experience / projects / education / skills）：先读素材、自己写好成品文案，然后通过 MCP 工具提交。
   - 单字段、单 bullet、单小段改动：**\`propose_edit({ sectionId, index, field, content })\`**
   - 一次成组的结构化任务：**\`propose_batch_edit({ title, summary, changes })\`**
   - \`title\` / \`contact\` / \`summary\`：纯文本，无 index/field。
   - \`experience\` / \`projects\`：数组，用 \`index\` + 默认 field \`details\`。
   - \`education\`：数组 { school, degree, major, date, tag }，用 \`index\` + \`field\`（school/degree/major/date/tag 之一）。
   - \`skills\`：数组 { category, content }，用 \`index\` + \`field\`（category/content 之一）。
3. 这些 MCP 提交只会生成「待确认」改动，**用户在工作台点「接受」后才会真正写入**，用户也可以拒绝。
4. 禁止运行 \`resume-agent confirm\` / \`resume-agent reject\`；这些命令已禁用，避免 agent 通过 Bash 绕过用户审核。
5. 禁止关闭、杀掉、重启、重打包、解包或修改 Resume Studio APP，除非用户明确要求做 APP 开发。简历内容修改不需要碰应用包。
6. 头像由用户在工作台上传，**不要**尝试设置头像。

## 推荐流程

1. 读 \`materials/.extracted/index.md\` 及相关抽取文件。
2. 调用 MCP \`get_context\` 理解当前 APP 文档、可见页和选中字段。
3. 理解用户真正做过什么，写出结果导向的简历文案。
4. 小改动用 \`propose_edit\`，一个完整任务里的多字段改动优先用 \`propose_batch_edit\`。
5. 等用户在工作台接受或拒绝。
`;
}
