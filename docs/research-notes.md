# Research Notes

## Scope

调研目标是为 Resume Studio 的两个方向提供依据：

- 产品介绍页如何表达价值。
- 简历历史存档和新模板重塑功能如何设计。

## Sources

### Paper

URL: https://paper.design/

可借鉴点：

- 首屏直接给出产品范畴和核心对象：teams、agents、code、data。
- 不是按功能列表堆叠，而是讲 continuous loop：从设计到代码再回到设计。
- 强调 MCP / agent / repo / app 之间的连接。
- 文案使用短句和明确动作，例如 connected canvas、design to code and back、connect any agent。

对 Resume Studio 的转译：

- 不使用 canvas 叙事，改成 resume workflow。
- 核心闭环是 materials -> agent -> diff -> history -> PDF。
- 文案重点是“AI 可以参与，但写入权留给用户”。

### Resumio

URL: https://www.resumio.ai/

可借鉴点：

- 首屏强调 AI-native resume studio。
- 使用数据化卖点、模板、ATS、JD diff、version history safety。
- 简历类产品需要快速说明“为什么比 Word/普通模板强”。

对 Resume Studio 的转译：

- 不主打 ATS 分数，避免和成熟 SaaS 同质化。
- 强调本地优先、agent 接入、人审 diff 和历史安全。

### Brevyx

URL: https://www.brevyx.com/

可借鉴点：

- 简历历史是明确功能点：搜索并访问生成过的 resumes。
- 工作流按 Upload -> Refine -> Generate 解释，降低用户理解成本。

对 Resume Studio 的转译：

- 历史功能不只是“查看旧简历”，而是“重塑前自动保存当前版本”。
- 工作流按 Read materials -> Agent proposes -> You approve 展示。

### OpenAI Codex for Open Source

URL: https://openai.com/form/codex-for-oss/

可借鉴点：

- 申请资格看 active open-source projects、usage、ecosystem importance、active maintenance。
- 表单要求 GitHub username、public repo、maintainer role、why qualify、API credits usage。

对 Resume Studio 的转译：

- GitHub 发布前必须清理个人数据和构建产物。
- 申请材料应强调 open-source value：local-first MCP workflow、safe agent write flow、private file trust architecture。

## Design Decision

最终选择白色系 premium utilitarian 方向：

- 大面积白色/灰白背景。
- 单一低饱和蓝色作为 live/MCP 状态色。
- 避免 AI 紫色渐变、深色科技感和三卡片模板感。
- 首屏采用左文案 + 右产品工作台模拟图，直接展示终端、简历、diff 三者连接。
- Browser landing 默认进入介绍页，Desktop App 默认进入工作台，兼顾 GitHub 展示和真实使用效率。

## History Feature Decision

采用本地 JSON 快照而非数据库：

- 当前项目数据结构简单，JSON 更透明，便于 agent 和用户理解。
- 历史文件存放在 `workspace/history/*.json`。
- 新建模板前自动归档当前简历。
- 恢复历史前也自动归档当前简历。
- 历史目录进入 `.gitignore`，避免上传个人简历。
