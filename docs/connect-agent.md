# 连接终端 AI 智能体到 Resume Studio

Resume Studio 采用与用户环境解耦的设计理念，不在界面内强行内置终端模拟器。你可以在**日常惯用的终端环境**（如 iTerm、Warp 或 macOS 原生终端）中运行各类 AI 智能体（Codex 命令行、Claude Code、Antigravity 命令行等），通过模型上下文协议（MCP）安全连入本地工作区。

---

## 接入路径

### 1. 源码开发环境
* **MCP 服务路径**：`/你的项目路径/bridge/mcp-server.cjs`
* **工作区路径**：`/你的项目路径/workspace`

### 2. 桌面安装版
* **MCP 服务路径**：`/Applications/Resume Studio.app/Contents/Resources/bridge/mcp-server.cjs`
* **工作区路径**：`/Users/你的用户名/Documents/ResumeStudio`

---

## 各终端智能体客户端配置

### 1. Codex 命令行配置

编辑 `~/.codex/config.toml` 文件：

#### 桌面安装版配置（推荐）：
```toml
[mcp_servers.resume-studio]
type = "stdio"
command = "node"
args = ["/Applications/Resume Studio.app/Contents/Resources/bridge/mcp-server.cjs"]

[mcp_servers.resume-studio.env]
WORKSPACE_DIR = "/Users/你的用户名/Documents/ResumeStudio"
```

#### 源码开发版配置：
```toml
[mcp_servers.resume-studio]
type = "stdio"
command = "node"
args = ["/你的项目路径/bridge/mcp-server.cjs"]

[mcp_servers.resume-studio.env]
WORKSPACE_DIR = "/你的项目路径/workspace"
```

> 请将 `/你的项目路径` 与 `你的用户名` 替换为本机实际绝对路径。

---

### 2. Claude Code 命令行配置

在 `~/.claude/mcp.json`（或项目根目录 `.claude/mcp.json`）中添加：

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

---

### 3. Antigravity 命令行 (`agy`) 配置

编辑 `~/.gemini/antigravity-cli/mcp_config.json`：

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

启动命令行助手：

```bash
agy
```

进入后输入 `/mcp`，检查并确认 `resume-studio` 工具列表已正常就绪。

---

## 验证与测试连接

1. 启动 **Resume Studio** 桌面应用（开发版运行 `npm run dev:desktop`；安装版通过启动台打开）。
2. 在终端启动智能体（如 `codex`、`claude` 或 `agy`）。
3. 让智能体执行 `get_context` 接口——应正确返回当前文档内容、选中字段及工作区对齐状态（`aligned: true`）。
4. 在桌面应用中切换模板或打开新文件，再次调用 `get_context`——文档修订版本号应自动递增。
5. 让智能体执行 `get_materials` 接口——应读取到本地提取的经历素材。
6. 让智能体提交一项测试建议：`propose_edit({ sectionId: "experience", index: 0, content: "测试经历文案" })`。
7. 观察桌面应用右下角即时弹出「待确认修改」悬浮条——即代表通信链路配置成功。

---

## 智能体协作提示词建议

在终端建立连接后，可直接向智能体发送以下协作指令：

```text
你已接入 Resume Studio 本地服务。请先调用 get_context 确认工作区已对齐，并调用 get_materials 查阅我的真实经历与项目素材。请根据我当前选中的字段与原始素材，撰写更具说服力与成果导向的简历文案。严禁直接修改 active-resume.json；单字段修改请调用 propose_edit，多字段综合改写请调用 propose_batch_edit 提交待确认补丁，等待我在桌面端界面中审阅并确认。
```

---

## 核心接口说明

| 接口名称 | 功能说明 |
|---|---|
| `get_context` | 读取当前文档、页码状态、选中字段、完整简历、待确认补丁与工作区诊断 |
| `get_resume` | 获取当前简历内容与工作区目录路径 |
| `get_materials` | 一键获取已摄入的全部结构化素材文本，省去智能体自行翻找文件的时间 |
| `propose_edit` | 提交单项字段的待确认修改建议（支持姓名、头衔、联系方式及经历正文） |
| `propose_batch_edit` | 批量提交一组结构化待确认改动，适用于教育经历、项目经历或多字段协同修改 |
| `get_pending_patch` | 查看当前尚未确认的修改补丁 |
| `get_activity` | 获取最近的系统操作与编辑记录 |
| `get_selection` | 获取用户在界面中当前点击选中的字段位置 |

> **安全机制说明**：智能体无权自行确认或直接写入简历文件。所有提议均以补丁形式暂存，仅能在 Resume Studio 桌面应用界面中由用户手动点击「接受」或「拒绝」。

