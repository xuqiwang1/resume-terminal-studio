# Resume Studio

Resume Studio 是一个本地优先的简历编辑工作台。它把桌面简历预览、本机素材管理、终端 AI agent 和人工确认流程连接在一起，让简历内容可以被 AI 辅助改写，但最终写入仍由用户确认。

## 核心方向

- **简历编辑优先**：围绕 A4 简历预览、结构化内容、素材摄入和 PDF 导出设计，不做通用文档或画布工具。
- **本地优先**：真实简历、素材和运行数据默认保存在本机工作区，不依赖云端账号。
- **终端联动**：Codex、Claude Code、Antigravity CLI 等 agent 通过本地 MCP server 接入，而不是让网页接管终端。
- **AI 提议，人确认**：agent 只能提交待确认改动；用户接受后才会写入简历。
- **过程可见**：工作台展示当前简历、待确认 diff、运行活动、历史存档和导出状态，减少黑箱改写。
- **可重塑不丢稿**：新建空白模板或恢复历史版本前会自动保存当前简历快照。

## 项目结构

```text
src/                  React 简历工作台
electron/             Electron 主进程与桌面运行时
bridge/               本地 bridge、MCP server、简历写入引擎
site/                 独立官网 / landing page，不属于 APP 内部页面
docs/                 架构与 agent 接入说明
build/                APP 图标资源
workspace-template/   打包用的非个人化默认简历模板
workspace/            本地开发工作区占位，不提交真实简历和素材
```

## 本地开发

安装依赖：

```bash
npm install
```

启动桌面开发版：

```bash
npm run dev:desktop
```

启动 bridge：

```bash
npm run dev:bridge
```

构建 macOS APP：

```bash
npm run build:desktop
```

运行测试：

```bash
npm test
```

预览独立官网：

```bash
open site/index.html
```

构建独立官网静态输出：

```bash
npm run site:build
```

官网输出目录为 `site-dist/`，属于生成产物，不提交到 GitHub。

## 素材摄入

把实习文档、项目笔记、数据表等材料放入工作区的 `materials/` 目录，然后运行：

```bash
npm run ingest
```

摄入结果会写入 `materials/.extracted/*.md`，终端 agent 可以读取这些干净文本，再基于真实素材写简历内容。

支持范围：

- `.md` / `.txt`：直接读取
- 文字版 PDF：抽取文本
- `.xlsx`：按 sheet 转成 markdown 表格

暂不处理扫描件 OCR、复杂表格版式还原、Word/PowerPoint 解析。

## MCP 接入

Resume Studio 自带本地 MCP server：

- 源码开发版：`bridge/mcp-server.cjs`
- 已安装 APP：`/Applications/Resume Studio.app/Contents/Resources/bridge/mcp-server.cjs`

核心工具：

| 工具 | 作用 |
|---|---|
| `get_context` | 读取当前文档、页码、选中字段、简历、pending patch 和 workspace 诊断 |
| `get_resume` | 读取当前简历和工作区路径 |
| `get_materials` | 一次读取已抽取素材，避免 agent 自己慢慢找文件 |
| `propose_edit` | 提交一项待确认改动，包含 name/title/contact/正文 |
| `propose_batch_edit` | 一次提交一组结构化待确认改动，适合教育/项目/多字段改写 |
| `get_pending_patch` | 查看当前待确认项 |
| `get_activity` | 读取最近活动 |
| `get_selection` | 读取用户当前选中的字段 |

所有 AI 写入都必须走 `propose_edit` 或 `propose_batch_edit`。agent 负责读取素材并写好最终文案，Resume Studio 只暂存改动并展示 diff，不替 agent 二次改写；接受/拒绝只能在 APP 工作台里完成，MCP 和 `resume-agent` CLI 都不能替用户确认。

Resume Studio 会把右侧当前文档身份写入 `context-state.json`，包括 `documentId`、`revision` 和 `activeResumePath`。这些字段现在由 bridge 服务端统一生成和递增：`/api/resume/new`、`/api/resume/history/open`、`/api/files/open`、`/api/files/save` 会在切换 active resume 的同一次请求里原子更新 document binding，并清掉 stale pending。MCP 在提案前会检查 App 当前文档路径和自己的 workspace 是否一致；不一致时直接报错，不生成 pending patch。pending patch 也会绑定创建时的 `documentId/revision`，用户新建模板、打开历史记录或切换文件后，旧 pending 会被清空或拒绝确认，避免把旧简历的 AI 改动应用到新简历上。

## 历史存档

工作区会维护 `history/` 快照目录。用户可以：

- 点击「保存当前版本」手动生成快照
- 点击「新建模板」自动归档当前简历并打开非个人化空白模板
- 从「历史」面板恢复旧版本；恢复前也会自动归档当前状态

历史文件属于本机运行数据，不应提交到 GitHub。

### Codex CLI

编辑 `~/.codex/config.toml`：

```toml
[mcp_servers.resume-studio]
type = "stdio"
command = "node"
args = ["/Applications/Resume Studio.app/Contents/Resources/bridge/mcp-server.cjs"]

[mcp_servers.resume-studio.env]
WORKSPACE_DIR = "/Users/your-name/Documents/ResumeStudio"
```

源码开发版把 `args` 改成项目里的 `bridge/mcp-server.cjs`，把 `WORKSPACE_DIR` 改成项目里的 `workspace`。

### Antigravity CLI (`agy`)

编辑 `~/.gemini/antigravity-cli/mcp_config.json`：

```json
{
  "mcpServers": {
    "resume-studio": {
      "command": "node",
      "args": [
        "/Applications/Resume Studio.app/Contents/Resources/bridge/mcp-server.cjs"
      ],
      "env": {
        "WORKSPACE_DIR": "/Users/your-name/Documents/ResumeStudio"
      }
    }
  }
}
```

启动 `agy` 后运行 `/mcp`，确认 `resume-studio` 已加载。

如果 `agy` 仍然显示旧工具（如 `confirm_patch`、`set_title`），关闭 `agy` 后删除缓存再启动：

```bash
rm -rf ~/.gemini/antigravity-cli/mcp/resume-studio
agy
```

新版工具列表不应包含 `confirm_patch`、`reject_patch`、`set_title`、`set_contact`。

## 推荐工作流

1. 打开 Resume Studio。
2. 把素材放进工作区 `materials/`，运行 `npm run ingest`。
3. 在终端启动 Codex、Claude Code 或 `agy`。
4. 让 agent 先调用 `get_context`，确认 `workspaceDiagnostics.aligned` 为 `true`，再调用 `get_materials`。
5. agent 写好文案后，单点改动调用 `propose_edit`，成组任务调用 `propose_batch_edit`。
6. 你在工作台确认或拒绝改动。

## GitHub 上传边界

应提交：

- `src/`
- `electron/`
- `bridge/`
- `site/`
- `docs/`
- `build/icon.svg`
- `build/icon.icns`
- `workspace-template/`
- `workspace/materials/.gitkeep`
- `package.json` / `package-lock.json` / `vite.config.js`

不应提交：

- `node_modules/`
- `dist/`
- `release/`
- `site-dist/`
- `workspace/active-resume.json`
- `workspace/materials/` 里的真实素材
- `workspace/materials/.extracted/`
- `workspace/*.rts.json`
- `workspace/history/`
- 本机日志、缓存、系统文件

真实简历和素材建议只保留在本机工作区，例如安装版默认的 `~/Documents/ResumeStudio`。

## License

MIT
