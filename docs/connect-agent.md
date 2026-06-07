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

## 验证连接

1. 启动 Resume Studio 工作台（开发版用 `npm run dev:desktop`；安装版用 `open -a "Resume Studio"`）
2. 在真终端运行你的 agent（如 `codex`、`claude` 或 `agy`）
3. 让 agent 执行 `get_resume` 工具——应返回当前简历 JSON
4. 让 agent 执行 `propose_edit({ sectionId: "experience", index: 0, content: "测试文案" })`
5. 观察工作台右下角弹出「AI 待确认改动」横幅——连接成功

## 可用的 MCP 工具

| 工具 | 作用 |
|---|---|
| `get_resume` | 读取当前简历 + 工作区路径 |
| `propose_edit` | 提议修改（需用户确认） |
| `propose_edit` + `bulletIndex` | 精确修改某条 bullet（行），不重写整段 |
| `confirm_patch` | 确认待定改动 |
| `reject_patch` | 拒绝待定改动 |
| `get_pending_patch` | 读取当前待确认项 |
| `set_title` | 直接设置求职意向 |
| `set_contact` | 直接设置联系方式 |
| `get_activity` | 读取活动日志 |
| `get_selection` | 获取用户当前选中的字段 |

## 推荐工作流

1. Agent 先执行 `get_resume` 了解当前简历内容
2. Agent 读取 `workspace/materials/.extracted/*.md` 获取你的真实素材
3. Agent 自己写好成品文案，调用 `propose_edit` 提交
4. 你在工作台点「接受」或「拒绝」，简历实时刷新

布局、字号、对齐方式请在工作台左侧样式面板直接调整——这些视觉操作不需要走 agent。
