# 架构草案

## 产品一句话

一个让用户在编辑简历时，能够继续使用 **本机原生终端**，同时在工作台里看到修改过程与结果回放的简历工作台。

## 北极星体验

- 用户打开工作台
- 用户继续在 macOS Terminal / iTerm 中执行 `resume-agent ...`
- 本地 bridge 监听命令活动日志与简历文件变化
- 前端同步展示：
  - 最近一次命令
  - stdout / stderr 摘要
  - section diff
  - 预览刷新
  - 导出结果

## 为什么不是纯网页

浏览器不应该接管用户电脑上的终端。

所以必须采用：

`原生 Terminal -> 本地 helper / 本地文件 -> localhost bridge -> 工作台界面`

## 核心设计原则：AI 提议，人确认（human-in-the-loop）

这是整个产品的信任基石：AI 可以辅助生成内容，但不能在用户没看见 diff、没确认的情况下直接覆盖简历。

**问题**：AI 改写简历最大的风险不是"改得不好"，而是"在用户没察觉时就改了"。一旦 AI 能直接覆盖简历内容，用户对这份简历的掌控感和信任就没了。

**判断**：风险不只住在"AI 的生成"里，也住在"agent 能否绕过用户确认"里。所以所有 agent 写入都必须进待确认闸门；只有用户在 APP 里的手动操作可以直接生效。

**规则**：

| 操作类型 | 例子 | 是否需要确认 |
|---|---|---|
| Agent 写入 | `propose_edit` 单字段改写，或 `propose_batch_edit` 成组改写 name/title/contact/summary/experience/projects/education/skills | ✅ 先进待确认暂存，人点「接受」才落库 |
| 用户手动编辑 | 在预览里自己打字 | ❌ 直接生效（用户即作者） |

**谁来"写文案"**：写作的智能**不在本项目里**，在终端的 agent（Codex/Claude）。agent 先读素材、自己写好成品文案，再通过 `propose_edit({sectionId, index, field, content})` 提交单字段改动，或通过 `propose_batch_edit({title, summary, changes})` 提交一个完整任务里的多项改动。engine 收到 content/value **原样暂存，不做任何改写**。

### 简历数据结构（契约）

`active-resume.json` 的字段与 `propose_edit` / `propose_batch_edit` 的定位关系：

| sectionId | 类型 | 可改子字段（field） | 默认 field |
|---|---|---|---|
| `name` | 纯文本（姓名） | 无（无 index/field） | — |
| `title` | 纯文本（求职意向） | 无（无 index/field） | — |
| `contact` | 纯文本（联系方式） | 无（无 index/field） | — |
| `summary` | 纯文本（可选，空则不渲染） | 无（无 index/field） | — |
| `education` | 数组 `{school,degree,major,date,tag}` | `school` / `degree` / `major` / `date` / `tag` | `school` |
| `skills` | 数组 `{category,content}` | `category` / `content` | `content` |
| `experience` | 数组 `{company,role,date,details}` | `details` | `details` |
| `projects` | 数组 `{name,role,date,details}` | `details` | `details` |

- 渲染顺序：header（name/contact/title/avatar）→ education → skills → experience → projects → summary（可选）。
- `avatar` 由用户在工作台上传，**不**经 `propose_edit`（不在其 enum 内）。
- 对数组类 section，`index` 0 提议到**空数组**时视为追加一条新项；越界 index 或非法 field 会被引擎拒绝、不写暂存槽。


**机制**：所有 AI 生成类改动统一经过引擎层的 `proposeEdit` / `proposeBatchEdit → commitPatch / rejectPatch` 三段式。

- `proposeEdit`：校验 target、记录 before、把 agent 写好的 content 存入单槽 `pending-patch.json`，**不写盘**
- `proposeBatchEdit`：校验整组 changes，记录每项 before/after，把一个任务级 batch 存入同一个 pending 槽，**不写盘**
- 工作台收到 SSE `pending` 事件 → 弹出 diff 横幅
- `commitPatch`：用户接受后**唯一的写入口**
- `rejectPatch`：放弃，简历零改动

**关键性质**：agent 写入只有**待确认 MCP 入口**：`propose_edit` 用于单点改动，`propose_batch_edit` 用于一个任务级批量改动。原生终端的 `resume-agent` 已移除 `ask`，并禁用 `confirm`/`reject`，避免 agent 通过 Bash 替用户确认。工作区 `CLAUDE.md` / `AGENTS.md` 也会明令禁止 agent 直接修改 `active-resume.json`、重启 APP 或改打包文件。新提议覆盖旧提议（单槽语义），保证待确认状态永远唯一、可解释。

### 当前文档绑定

App 会在启动、保存、打开文件、新建模板、恢复历史时同步 `context-state.json.document`。该对象包含：

- `documentId`：右侧当前文档的稳定身份，例如 `template:active` 或 `file:xxx.rts.json`
- `revision`：文档切换或重新同步时的版本号
- `activeResumePath`：App 当前读写的 `active-resume.json` 绝对路径

MCP 的 `get_context` 会返回 `activeDocument` 和 `workspaceDiagnostics`。`workspaceDiagnostics.aligned` 表示 MCP 的 `WORKSPACE_DIR` 与 App 当前文档路径是否一致。`propose_edit` / `propose_batch_edit` 在生成 pending 前会做同样校验；不一致时快速失败，不写 `pending-patch.json`。

pending patch 创建时会保存 `documentId`、`revision`、`activeResumePath`。如果用户随后新建模板、打开历史记录或切换文件，core 会清空 stale pending；即使旧 pending 残留，确认阶段也会拒绝应用。

## 素材摄入：读放开，但先抽成干净文本

agent 要"懂你"，得先读到你的真实材料（实习文档、项目笔记、数据表）。但 PDF/Excel 是二进制，agent 直接读是乱码。所以加一层**手动触发的摄入**：

```
materials/                      ← 你把原始素材丢这里（.md/.txt/.pdf/.xlsx）
  ↓  resume-agent ingest（或 npm run ingest）
materials/.extracted/*.md       ← 抽取后的干净文本 + index.md 清单
  ↓
agent 用终端原生能力读 .extracted/  ← 读，完全放开
```

- `.md/.txt`：原样
- 文字版 PDF：`pdf-parse` 抽文本（扫描件无文本层 → 跳过并告警，不崩）
- `.xlsx`：每个 sheet 转 markdown 表格

**边界（明确不做）**：OCR / 扫描件、复杂合并单元格还原、doc/ppt。手动触发而非实时监听（解析有耗时，按需跑一次最简单）。

## 系统分层

### 1. Frontend

- 简历预览
- 模板切换
- section 选择
- 活动回放面板
- diff 面板
- 历史存档面板
- 导出 PDF 入口
- 原生 Terminal 使用说明

### 2. Local Bridge

- 监听 `active-resume.json`
- 监听 `activity-log.ndjson`
- 向前端广播结构化活动事件
- 提供保存 / 打开 / 导出接口
- 提供历史快照、新建模板、恢复历史接口
- 提供本地 MCP 数据源给 Codex / Claude Code / 其他 agent

### 3. Native Helper

- `workspace/resume-agent`
- 在用户原生终端中直接执行
- 只保留 confirm / reject / ingest 等确定性命令
- 写入 `activity-log.ndjson`

### 4. MCP Server

- `bridge/mcp-server.cjs`
- 通过 stdio 暴露工具给本地 agent
- 工具层调用与 `resume-agent` 共用同一套 resume engine
- 目标是让 Codex 直接发自然语言指令，而不是让用户自己拼命令

## 推荐第一版技术路线

### 前端

- React + Vite
- 原生 CSS 变量与组件级样式
- 浏览器默认展示产品介绍页，桌面 App 默认进入工作台

### 本地 bridge

- Node.js
- SSE 推送文件活动流
- `fs.watch` 监听本地文件变更

### 本地 MCP

- stdio JSON-RPC
- `tools/list`
- `tools/call`
- 与工作台共享同一份 `active-resume.json`
- PDF 导出走「预览即导出」：在工作台界面触发（桌面 `printToPDF` / 浏览器 `window.print()` + `@media print`），不再由 MCP/引擎平行渲染

### 数据格式

- `resume.json`：简历主数据
- `task events`：前端 Console 事件流
- `section diff`：修改前后对比
- `history/*.json`：本地简历历史快照

## 第一版动作白名单

- `tailor_resume_for_jd`
- `rewrite_summary`
- `rewrite_experience`
- `reorder_sections`
- `export_pdf`

不要在网页里开放“任意命令执行”，先让原生终端执行受控 helper 命令。

## 可复用的通用简历产品能力

- 简历模板 registry
- 简历结构化数据
- A4 预览模式
- PDF 导出流程

## 我们要重做的部分

- 操作入口
- 主编辑交互
- 活动回放面板
- 原生终端观察桥接
- diff 呈现
