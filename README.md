# Resume Studio

Resume Studio 是一个面向求职者与技术人员的本地优先（Local-First）桌面端简历编辑工作台。它将即时 A4 简历排版预览、本机多格式原始素材管理、终端 AI 智能体辅助与人工审核确认流程紧密连接，让简历内容能够在 AI 协助下高质量迭代，同时保证用户对简历数据的绝对掌控与隐私安全。

---

## 核心特性

* **简历编辑专精**：围绕标准 A4 单页排版、结构化内容组织、本机原始素材摄入和高保真 PDF 导出设计，拒绝冗余复杂的通用文档或画布功能。
* **本地优先与隐私保护**：真实简历、项目素材、历史版本与运行数据均保存在本地计算机，不依赖任何云端账号，彻底杜绝个人职业资产与隐私泄露风险。
* **4 款精选简历模板矩阵**：
  * **专业商务 (Professional)**：严谨求职标准版式，信息密度高，层级分明，通用性强。
  * **经典求职 (Classic)**：头像右置、标题下划线分隔，紧凑单列设计，适合大篇幅经历密排。
  * **现代风尚 (Modern)**：典雅蓝调强调色，居中标题与呼吸感排版，支持条目加粗导语。
  * **商务精英 (Executive)**：三列专业能力网格，深蓝沉稳质感，模块化版式支持灵活混排。
* **A4 单页智能自适应**：
  * 内置受限二分自适应算法，一键微调行距与字号，平滑消除页面溢出并同步至导出引擎。
  * 溢出精准归因：当内容超出单页承载范围时，实时高亮并精确定位具体溢出的内容模块。
* **左侧版式与样式控制台**：
  * 支持经历与内容模块上下拖拽重排，并实时自动保存。
  * 丰富的超链接样式选项（默认蓝、正文继承色、下划线开关）。
  * 细粒度字号、行距、页边距、强调色及头像自由拖拽定位。
* **AI 提议，人工把关**：
  * 终端智能体（Codex、Claude Code、Antigravity 等）通过本地模型上下文协议（MCP）接入。
  * 智能体仅能提交带有证据溯源与风险分级的待确认补丁，用户在界面中审阅差异对比后确认写入。
* **防丢失与冲突防护**：
  * 每次接受 AI 改动前自动归档快照（最多保留 40 个自动检查点）。
  * 智能冲突检测：若待确认补丁基于的旧内容已被人工编辑，将提示并阻止无感覆盖。

---

## 项目结构

```text
src/                  React 简历前端界面与模板渲染组件
electron/             Electron 主进程与桌面端运行时环境
bridge/               本地 HTTP 桥接服务、MCP 服务与简历写入引擎
site/                 独立产品官网（展示页面），独立于桌面端应用
docs/                 架构设计与智能体接入说明文档
build/                桌面端应用图标与打包构建资源
workspace-template/   打包分发的默认非个人化空白简历模板
workspace/            本地开发工作区占位目录（不提交真实简历与素材）
```

---

## 本地开发与构建

### 1. 安装依赖

```bash
npm install
```

### 2. 运行桌面开发版

```bash
npm run dev:desktop
```

### 3. 运行本地桥接服务（供终端命令行或独立前端调试使用）

```bash
npm run dev:bridge
```

### 4. 运行自动化测试

```bash
npm test
```

### 5. 打包 macOS 桌面应用

```bash
npm run build:desktop
```

### 6. 安装应用到「应用程序」目录

该命令会自动构建并将应用安装至 `/Applications/Resume Studio.app`，同时清理打包临时目录避免系统检索冲突：

```bash
npm run install:desktop
```

### 7. 预览与构建产品官网

```bash
# 本地预览官网
open site/index.html

# 静态打包官网（输出至 site-dist/）
npm run site:build
```

---

## 本机素材摄入

将日常的项目总结、实习笔记、数据表格等原始材料直接放入工作区的 `materials/` 目录中，然后运行：

```bash
npm run ingest
```

摄入程序会自动提取并生成规范的 Markdown 文件存放在 `materials/.extracted/*.md` 中。终端智能体可直接读取这些结构化文本，基于真实经历撰写简历内容。

**目前支持的素材格式：**
* 纯文本 / Markdown（`.txt`、`.md`）
* 文字版 PDF 文档
* Excel 表格（`.xlsx`，自动将各工作表转换为 Markdown 表格）

---

## 终端智能体与 MCP 接入

Resume Studio 内置了标准的本地模型上下文协议（Model Context Protocol / MCP）服务：
* **源码开发路径**：`bridge/mcp-server.cjs`
* **已安装应用路径**：`/Applications/Resume Studio.app/Contents/Resources/bridge/mcp-server.cjs`

### 核心接口列表

| 接口名称 | 功能描述 |
|---|---|
| `get_context` | 读取当前文档信息、页码状态、用户选中字段、完整简历、待确认补丁与工作区对齐诊断 |
| `get_resume` | 获取当前简历内容与工作区目录路径 |
| `get_materials` | 一键获取已摄入的全部结构化素材文本，省去智能体自行翻找文件的时间 |
| `propose_edit` | 提交单项字段的待确认修改建议（支持姓名、头衔、联系方式及经历正文） |
| `propose_batch_edit` | 批量提交一组结构化待确认改动，适用于教育经历、项目经历或多字段协同修改 |
| `get_pending_patch` | 查看当前尚未确认的修改补丁 |
| `get_activity` | 获取最近的系统操作与编辑记录 |
| `get_selection` | 获取用户在界面中当前点击选中的字段位置 |

### 客户端配置示例

#### 1. Codex 命令行配置

编辑 `~/.codex/config.toml`：

```toml
[mcp_servers.resume-studio]
type = "stdio"
command = "node"
args = ["/Applications/Resume Studio.app/Contents/Resources/bridge/mcp-server.cjs"]

[mcp_servers.resume-studio.env]
WORKSPACE_DIR = "/Users/your-name/Documents/ResumeStudio"
```

*(源码开发模式下，请将 `args` 指向项目内的 `bridge/mcp-server.cjs`，并将 `WORKSPACE_DIR` 设置为项目的 `workspace` 目录。)*

#### 2. Antigravity 命令行 (`agy`) 配置

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

启动 `agy` 后输入 `/mcp`，检查并确认 `resume-studio` 工具已正常加载。

---

## 推荐协作工作流

1. 启动并打开 **Resume Studio** 桌面应用。
2. 将参考资料和项目笔记放入工作区 `materials/` 目录，执行 `npm run ingest` 提取素材。
3. 在终端启动 Codex、Claude Code 或 `agy`。
4. 智能体先调用 `get_context`，确认 `workspaceDiagnostics.aligned` 为 `true`，再通过 `get_materials` 查阅经历素材。
5. 智能体拟定修改建议后，单点改动调用 `propose_edit`，成组重构调用 `propose_batch_edit`。
6. 用户在桌面应用界面中审阅差异对比与证据来源，点击「接受」应用修改或点击「拒绝」放弃变更。

---

## 历史存档与快照管理

工作区会在本地维护 `history/` 快照目录，提供多重防丢失保障：
* 点击顶部「保存当前版本」可手动生成具名快照。
* 点击「新建模板」会自动归档当前简历，并打开初始空白模板。
* 在「历史」面板中可以随时预览或恢复任意历史版本；恢复操作前同样会自动保存当前工作快照。

---

## 代码仓库提交规范

**应当提交的内容：**
* 核心源码与组件（`src/`、`electron/`、`bridge/`、`site/`、`docs/`）
* 应用图标与配置资源（`build/`）
* 默认非个人化空白简历模板（`workspace-template/`）
* 项目基础配置（`package.json`、`vite.config.js` 等）

**严禁提交的内容：**
* 依赖包与编译输出（`node_modules/`、`dist/`、`release/`、`site-dist/`）
* 真实个人简历数据（`workspace/active-resume.json`、`workspace/*.rts.json`）
* 真实私密素材与提取文本（`workspace/materials/*`、`workspace/materials/.extracted/`）
* 本地历史快照与日志（`workspace/history/`、`*.log`）

---

## 开源协议

本项目采用 [MIT License](LICENSE) 开源协议。
