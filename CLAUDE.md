# Resume Studio — AI 智能体使用说明

本项目是一个本地优先的简历编辑工作台。简历属于用户的核心资产：**AI 只能提交待确认的修改建议，严禁直接覆写。**

## 核心规则

1. **严禁直接修改 `workspace/active-resume.json`**（或已安装应用路径 `~/Documents/ResumeStudio/active-resume.json`）。直接修改文件会绕过用户的人工审核机制。
2. 所有正文修改必须通过命令行工具（或 MCP 接口 `propose_edit` / `propose_batch_edit`）提交，生成待确认补丁（pending patch）。
3. 待确认补丁只有在用户于桌面应用界面中点击「接受」后才会真正写入。**切勿**替用户执行确认或拒绝。
4. 简历头像由用户在工作台界面自主上传与排版，无需也不要尝试通过接口设置。
5. 除非用户明确要求进行应用底层开发，否则不要退出、终止、重启或重新打包桌面应用。

## 运行前置条件

桌面应用或本地服务必须处于运行状态：

```bash
npm run dev:bridge   # 开发模式，本地服务端口 4318
```

命令行工具会自动通过 `~/.resume-studio/runtime.json` 发现正在运行的实例（服务端口、身份凭证、工作区路径），因此始终会自动连接到用户当前正在查看的简历文档。

## 命令行操作

```bash
node bridge/bin/resume-cli.cjs health        # 检查连接状态与工作区对齐情况
node bridge/bin/resume-cli.cjs context       # 读取当前文档状态与用户选中的字段
node bridge/bin/resume-cli.cjs show          # 读取完整简历 JSON
node bridge/bin/resume-cli.cjs pending       # 读取当前待确认的修改项
node bridge/bin/resume-cli.cjs edit <section> [--index N] [--field F] [--bullet N] <content>
node bridge/bin/resume-cli.cjs ingest        # 扫描 materials/ 抽取结构化素材（本地执行，无需桥接服务）
```

## 推荐工作流

1. 执行 `health` 确认本地服务正常运行。
2. 执行 `ingest` 后读取 `workspace/materials/.extracted/index.md` 了解用户真实经历素材。
3. 执行 `context` 确认用户当前正在查看或选中的简历模块。
4. 执行 `show` 读取简历完整上下文。
5. 撰写高质量润色文案后，使用 `edit` 提交建议 → 桌面应用弹出待确认浮条。
6. 等待用户在界面中审阅并手动点击接受或拒绝。

## 简历模块说明

* `name`、`title`、`contact`、`summary`：单字段纯文本，无需指定 index 或 field。
* `experience`、`projects`：经历数组，配合 `--index` 指定条目序号，默认修改 `details` 详情字段。
* `education`：教育经历数组 `{ school, degree, major, date, tag }`，配合 `--index` 与 `--field` 指定字段。
* `skills`：技能特长数组 `{ category, content }`，配合 `--index` 与 `--field` 指定字段。

### 提交示例

```bash
node bridge/bin/resume-cli.cjs edit title "AI 产品经理"
node bridge/bin/resume-cli.cjs edit experience --index 0 --field details "主导 AI 订单数据分析智能体建设，提升跨部门分析效率 40%"
node bridge/bin/resume-cli.cjs edit education --index 0 --field major "社会学"
```

## 项目结构

* `bridge/` — 本地 HTTP 桥接服务、MCP 服务与简历写入引擎
* `bridge/bin/resume-cli.cjs` — 供 AI 智能体调用的命令行入口
* `src/` — 桌面端 React 前端应用
* `workspace/` — 本地运行时数据（当前简历、待确认补丁、素材文件等）

## 测试验证

```bash
npm test
```

