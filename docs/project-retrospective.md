# Resume Studio 项目开发复盘

## 一句话总结

Resume Studio 是一个本地优先的 AI 简历编辑工作台：它把桌面简历预览、本机素材摄入、MCP 兼容终端 agent、人审 diff、历史存档和 PDF 导出串成一个可控闭环，解决“AI 可以帮我写，但不能偷偷替我改”的信任问题。

## 背景与问题

传统简历编辑器通常有两类形态：

- 表单/模板主导：用户逐项填写内容，AI 只是润色按钮，真实项目素材和写作上下文很难进入编辑过程。
- AI 生成主导：用户输入提示词或岗位 JD，系统直接输出新简历，速度快但过程不可见，用户很难判断改动依据、风险和可回退性。

Resume Studio 选择了第三种方向：不把终端 agent 藏进网页，而是承认用户已经在 Codex、Claude Code、Antigravity CLI 等环境里工作，让这些 agent 通过本地 MCP server 接入简历工作区。产品重点不是“生成得多快”，而是“生成过程是否可信、写入是否可控、失败后是否可回退”。

## 调研结论

### Paper.design 的启发

Paper 的产品介绍强调 connected workflow：团队、agent、代码和数据在同一个工作空间里保持连续循环。Resume Studio 没有沿用画布产品形态，而是提炼了其中的“连接”和“闭环”思想：

- 从真实内容到 AI 操作再到最终产物，中间状态不能丢。
- agent 不是魔法按钮，而是工作流参与者。
- 设计目标不是替代人，而是把重复劳动交给 agent，把判断权留给人。

### 简历类竞品的启发

AI resume builder 常见卖点包括 ATS、模板、JD tailor、AI rewrite、PDF/DOCX export 和 resume history。Resume Studio 保留了简历产品必需能力，但差异化放在：

- 本地素材摄入，而不是云端上传为默认。
- MCP agent 接入，而不是封闭聊天框。
- pending patch 人审，而不是直接覆盖。
- 历史存档，让用户可以大胆重做而不丢旧版本。

## 产品原则

### 1. AI 提议，人确认

AI 生成内容的不确定性和 agent 绕过用户确认都是核心风险。项目将 title/contact/正文改写统一收敛到待确认 MCP 入口：窄范围改动用 `propose_edit`，一个完整任务里的多字段改动用 `propose_batch_edit`。agent 自己写好成品文案，提交到 pending patch，前端展示 diff，用户接受后才落盘。

用户在工作台里的手动编辑可以直接生效，因为用户就是作者；agent 生成的 title/contact/正文都必须先进 pending patch。

### 2. 本地优先

真实简历、素材、历史版本和运行日志默认保存在本机工作区。安装版工作区位于 `~/Documents/ResumeStudio`，开发版工作区位于项目 `workspace/`。GitHub 仓库只提交非个人化模板和源码，不提交真实简历与材料。

### 3. 工作流连续

产品不是单点功能集合，而是一条连续链路：

`materials -> ingest -> extracted markdown -> terminal agent -> MCP propose_edit/propose_batch_edit -> pending diff -> user confirm -> active resume -> history/PDF`

这条链路让每个关键状态都有明确归属：素材由用户提供，写作由 agent 完成，确认由用户完成，写入由 engine 完成。

### 4. 可重塑不丢稿

简历经常需要针对不同岗位重构。如果每次重构都要担心覆盖旧版本，用户就不敢大改。因此新增历史存档：

- 手动保存当前版本。
- 新建空白模板前自动归档当前简历。
- 恢复历史版本前也自动归档当前状态。

## 技术架构

### Frontend

- React + Vite。
- 原生 CSS 变量管理白色系视觉语言。
- 浏览器默认展示产品介绍页；桌面 App 默认进入工作台。
- 工作台包含样式面板、A4 预览、历史面板、pending diff banner、PDF 导出入口。

### Electron

- macOS 桌面包装。
- 隐藏标题栏，使用本机窗口体验。
- 主进程启动本地 bridge，并向 renderer 注入 bridge URL、token 和 session id。
- PDF 导出通过 Electron `printToPDF` 使用屏幕预览直接导出。

### Local Bridge

- Node HTTP server。
- 提供 resume、activity、pending patch、history、files 等接口。
- 使用 SSE 推送简历、活动和 pending 状态。
- 使用 token 保护本地接口，避免任意页面访问本地简历数据。

### MCP Server

- `bridge/mcp-server.cjs` 通过 stdio 暴露工具给 Codex/Claude/agy。
- 核心工具包括 `get_context`、`get_resume`、`get_materials`、`propose_edit`、`propose_batch_edit`、`get_pending_patch`、`get_activity`、`get_selection`。
- agent 不应直接写 `active-resume.json`，也不能确认/拒绝 pending patch；必须走 MCP 工具提交待确认改动，由用户在 APP 里接受或拒绝。

### Storage

- `active-resume.json`：当前简历。
- `pending-patch.json`：单槽待确认改动。
- `history/*.json`：历史快照。
- `materials/.extracted/*.md`：素材抽取结果。
- `activity-log.ndjson`：活动日志。

## 关键实现

### Pending patch 单槽机制

`propose_edit` / `propose_batch_edit` 不写简历，只写 pending patch。single patch 包含 before、after、sectionId、index、field、bulletIndex 等定位信息；batch patch 包含一组已校验的 changes。用户确认后，engine 才将 patch 应用到 active resume，并清空 pending slot。

单槽设计降低复杂度：同一时间只有一个待确认改动，避免多 patch 排队时的冲突和认知负担。

### 历史存档

新增 `historyDir`、`createResumeArchive`、`listResumeArchives`、`createNewResumeFromTemplate`、`restoreResumeArchive`。新建模板前自动归档，恢复历史前也自动归档，形成可回退链路。

同时增加了路径安全校验：

- 历史文件只允许 basename + `.json`。
- 简历文档只允许 basename + `.rts.json`。
- 禁止 `../` 路径穿越读取工作区外文件。

### 文件 watcher 循环修复

早期实现中，前端收到 resume stream 后会自动 diff 前后状态并播放 patch animation。外部写入或 watch 多次触发时，用户会看到“写入一直循环”。修复方式是：

- resume stream 只负责同步状态。
- patch animation 只由明确的 patch/confirm 行为触发。

这样文件系统多次事件不会被误解为多次 AI 写入。

## 视觉设计

### 产品介绍页

白色系、低饱和、结构化网格，叙事围绕：

- 简历可以交给 AI 协作，但不能交出控制权。
- materials → agent → diff → history → PDF。
- 本地优先、MCP-ready、人审 diff、历史快照。

页面借鉴 connected workflow 的表达方式，但不是画布产品；核心视觉资产是本地终端 + A4 简历 + pending diff 的组合。

### App 图标

重新设计为白色陶瓷底、浅灰纸张、黑色终端层、低饱和蓝色状态点。图标表达：

- 白色底：简历、文档、清洁感。
- 纸张：最终交付物是简历。
- 终端符号：agent 从本机终端接入。
- 蓝色状态点：MCP ready / live bridge。

## 安全与稳健性审计

已处理的风险：

- 修复 `openResumeDocument` 路径穿越风险。
- history restore 增加文件名校验。
- bridge 接口支持 token 鉴权。
- pending patch 避免 AI 直接覆盖正文。
- `.gitignore` 排除真实简历、素材、历史版本、构建产物、node_modules。
- 安装包使用非个人化 `workspace-template/active-resume.json`。

仍可继续增强的方向：

- 增加 CSP，限制 renderer 加载资源。
- 移除 preload 中未使用的 terminal IPC 暴露。
- 给 `saveResumeDocument` 增加 schema 校验。
- 增加 GitHub Actions 自动运行测试和 build。
- 增加 release 校验脚本，确认包内不含个人数据。

## 验证方式

当前核心验证包括：

- `node bridge/core/core.test.cjs`
- `node bridge/bin/pending-patch.test.cjs`
- `node bridge/historyStore.test.mjs`
- `node bridge/fileStoreSecurity.test.mjs`
- `node bridge/bin/auth.test.cjs`
- `node src/lib/fileClient.test.mjs`
- `npm run build`
- `npm run build:desktop`

## 项目收获

这个项目的关键价值不在“做了一个简历编辑器”，而在设计并验证了一套更可信的 AI 产品交互模式：

- AI 负责读取上下文和生成候选方案。
- 产品负责呈现差异、限制写入边界、保留历史版本。
- 用户负责判断是否接受。

这比单纯追求“一键生成”更接近真实 AI 产品经理需要解决的问题：如何把不确定的模型能力放进确定、可控、可解释的产品流程里。

## 后续路线

- 增加 GitHub Actions。
- 增加更多简历模板。
- 支持 JD 专项版本管理。
- 支持多份 resume profiles。
- 增加 MCP 工具级权限说明。
- 增加 demo video 和 release notes。
