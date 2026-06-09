# 连接终端 AI Agent 到 Resume Studio

Resume Studio 不内置终端。你在**自己喜欢的真终端**（iTerm / Warp / macOS Terminal）里运行 AI agent（Codex CLI、Claude Code、Antigravity CLI），通过 MCP 连入工作区即可。

## 路径选择

源码开发版：

- MCP server：`/你的项目路径/bridge/mcp-server.cjs`
- 工作区：`/你的项目路径/workspace`

已安装 APP 版：

- MCP server：`/Applications/Resume Studio.app/Contents/Resources/bridge/mcp-server.cjs`
- 工作区：`/Users/你的用户名/Documents/ResumeStudio`

## Codex CLI 配置

在 `~/.codex/config.toml` 中添加：

当前这台电脑、当前源码仓库可直接复制：

```toml
[mcp_servers.resume-studio]
type = "stdio"
command = "node"
args = ["/Users/xuqiwang/Desktop/终端简历编辑器/bridge/mcp-server.cjs"]

[mcp_servers.resume-studio.env]
WORKSPACE_DIR = "/Users/xuqiwang/Desktop/终端简历编辑器/workspace"
```

已安装 APP 版可直接复制：

```toml
[mcp_servers.resume-studio]
type = "stdio"
command = "node"
args = ["/Applications/Resume Studio.app/Contents/Resources/bridge/mcp-server.cjs"]

[mcp_servers.resume-studio.env]
WORKSPACE_DIR = "/Users/xuqiwang/Documents/ResumeStudio"
```

通用源码模板：

```toml
[mcp_servers.resume-studio]
type = "stdio"
command = "node"
args = ["/你的项目路径/bridge/mcp-server.cjs"]

[mcp_servers.resume-studio.env]
WORKSPACE_DIR = "/你的项目路径/workspace"
```

> 把 `/你的项目路径` 替换为项目实际绝对路径。

如果连接已安装到 `/Applications` 的 APP：

```toml
[mcp_servers.resume-studio]
type = "stdio"
command = "node"
args = ["/Applications/Resume Studio.app/Contents/Resources/bridge/mcp-server.cjs"]

[mcp_servers.resume-studio.env]
WORKSPACE_DIR = "/Users/你的用户名/Documents/ResumeStudio"
```

## Claude Code 配置

在 `~/.claude/mcp.json`（或项目根目录 `.claude/mcp.json`）中添加：

```json
{
  "mcpServers": {
    "resume-studio": {
      "command": "node",
      "args": ["/你的项目路径/bridge/mcp-server.cjs"],
      "env": {
        "WORKSPACE_DIR": "/你的项目路径/workspace"
      }
    }
  }
}
```

## Antigravity CLI (`agy`) 配置

在 `~/.gemini/antigravity-cli/mcp_config.json` 中添加：

```json
{
  "mcpServers": {
    "resume-studio": {
      "command": "node",
      "args": ["/Applications/Resume Studio.app/Contents/Resources/bridge/mcp-server.cjs"],
      "env": {
        "WORKSPACE_DIR": "/Users/你的用户名/Documents/ResumeStudio"
      }
    }
  }
}
```

启动：

```bash
agy
```

进入后先运行 `/mcp`，确认 `resume-studio` 已加载。

如果 `agy` 仍然只显示旧工具（例如 `confirm_patch`、`set_title`），说明它缓存了旧 schema。关闭 `agy` 后删除缓存目录再启动：

```bash
rm -rf ~/.gemini/antigravity-cli/mcp/resume-studio
agy
```

新版工具列表不应包含 `confirm_patch`、`reject_patch`、`set_title`、`set_contact`。

## 验证连接

1. 启动 Resume Studio 工作台（开发版用 `npm run dev:desktop`；安装版用 `open -a "Resume Studio"`）
2. 在真终端运行你的 agent（如 `codex`、`claude` 或 `agy`）
3. 让 agent 执行 `get_context` 工具——应返回当前文档、页码、选中字段、简历 JSON，并且 `workspaceDiagnostics.aligned` 应为 `true`
4. 在工作台里切换一次模板、历史或 `.rts.json` 文件后，再次执行 `get_context`——`activeDocument.revision` 应递增，旧 pending 不应继续可确认
5. 让 agent 执行 `get_materials` 工具——应返回 `materials/.extracted/` 里的抽取素材
6. 让 agent 执行 `propose_edit({ sectionId: "experience", index: 0, content: "测试文案" })`，或用 `propose_batch_edit` 提交一个包含多项 change 的任务级草稿
7. 观察工作台右下角弹出「AI 待确认改动」横幅——连接成功

## 给 Agent 的启动口令

连接后直接复制这句话给 agent：

```text
你已经连接 Resume Studio MCP。请先调用 get_context，确认 workspaceDiagnostics.aligned 为 true，再调用 get_materials。基于 context.selection 判断我当前选中的字段，基于 materials 写一版更强的简历文案；不要直接修改 active-resume.json。单字段或单 bullet 用 propose_edit；一个完整任务里的多字段、多条目改动用 propose_batch_edit。只提交待确认 patch，等待我在 Resume Studio 里接受或拒绝。
```

## 可用的 MCP 工具

| 工具 | 作用 |
|---|---|
| `get_context` | 读取当前文档、页码、选中字段、简历、pending patch 和 workspace 诊断 |
| `get_resume` | 读取当前简历 + 工作区路径 |
| `get_materials` | 一次读取抽取素材，避免 agent 自己慢慢找文件 |
| `propose_edit` | 提议修改（需用户确认） |
| `propose_batch_edit` | 一次提交一组结构化改动（需用户确认），适合教育/项目/多字段任务 |
| `propose_edit` + `bulletIndex` | 精确修改某条 bullet（行），不重写整段 |
| `get_pending_patch` | 读取当前待确认项 |
| `get_activity` | 读取活动日志 |
| `get_selection` | 获取用户当前选中的字段 |

Agent 不能确认、拒绝或直接写入简历；单字段改动通过 `propose_edit`，批量结构化任务通过 `propose_batch_edit` 生成待确认 patch。接受/拒绝只能在 Resume Studio 工作台操作。`propose_edit` 支持 `name/title/contact/summary` 等纯文本字段；批量提案遇到不支持的结构会快速返回 schema error，不会长时间挂起或污染已有 pending。

## 推荐工作流

1. Agent 先执行 `get_context` 了解当前 APP 文档、页码和选中字段，并确认 `workspaceDiagnostics.aligned`
2. Agent 执行 `get_materials` 获取你的真实素材
3. Agent 自己写好成品文案，单点改动调用 `propose_edit`，成组任务调用 `propose_batch_edit`
4. 你在工作台点「接受」或「拒绝」，简历实时刷新

布局、字号、对齐方式请在工作台左侧样式面板直接调整——这些视觉操作不需要走 agent。
