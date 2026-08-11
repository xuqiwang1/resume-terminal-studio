# Resume Studio — AI Agent 使用说明

本项目是一个本地简历编辑工作台。简历是用户的资产：**AI 只能提交待确认改动，不能直接写入。**

## 核心规则

1. **禁止直接修改 `workspace/active-resume.json`**（或桌面版的 `~/Documents/ResumeStudio/active-resume.json`）。直接写文件会绕过用户审核。
2. 所有正文改动必须走 CLI（或 MCP `propose_edit` / `propose_batch_edit`），生成 pending patch。
3. pending patch 只有用户在 APP 里点「接受」才会写入。**不要**替用户确认或拒绝。
4. 头像由用户在工作台上传，不要尝试设置。
5. 不要退出 / 杀死 / 重启 / 重打包 APP，除非用户明确要求做 APP 开发。

## 前置条件

桌面 APP 或 bridge 服务必须在运行：

```bash
npm run dev:bridge   # 开发模式，端口 4318
```

CLI 通过 `~/.resume-studio/runtime.json` 自动发现正在运行的实例（端口、token、workspace），
所以它总是连到用户当前实际在看的那份简历。

## CLI 命令

```bash
node bridge/bin/resume-cli.cjs health        # 检查连接与 workspace 对齐
node bridge/bin/resume-cli.cjs context       # 当前文档状态 + 用户选中的字段
node bridge/bin/resume-cli.cjs show          # 完整简历 JSON
node bridge/bin/resume-cli.cjs pending       # 当前待确认改动
node bridge/bin/resume-cli.cjs edit <section> [--index N] [--field F] [--bullet N] <content>
node bridge/bin/resume-cli.cjs ingest        # 扫描 materials/ 抽取素材（本地，不需 bridge）
```

## 工作流

1. `health` 确认 bridge 在跑
2. `ingest` 后读 `workspace/materials/.extracted/index.md` 了解用户真实素材
3. `context` 了解用户当前在看哪一段
4. `show` 读完整简历
5. 自己写好成品文案，用 `edit` 提交 → APP 弹确认条
6. 等用户接受或拒绝

## Sections

`name`、`title`、`contact`、`summary` — 纯文本，无需 index/field
`experience`、`projects` — 数组，用 `--index` + 默认 field `details`
`education` — 数组 { school, degree, major, date, tag }，用 `--index` + `--field`
`skills` — 数组 { category, content }，用 `--index` + `--field`

### 示例

```bash
node bridge/bin/resume-cli.cjs edit title "AI 产品经理"
node bridge/bin/resume-cli.cjs edit experience --index 0 --field details "新的经历描述"
node bridge/bin/resume-cli.cjs edit education --index 0 --field major "社会学"
```

## 项目结构

- `bridge/` — HTTP bridge + MCP server + resume engine
- `bridge/bin/resume-cli.cjs` — AI agent 的 CLI 入口
- `src/` — 前端 React 应用
- `workspace/` — 运行时数据（简历 JSON、pending patch、materials）

## 测试

```bash
npm test
```
