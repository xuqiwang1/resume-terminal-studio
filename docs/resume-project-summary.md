# 简历短版项目描述

## 终端简历编辑器 Resume Studio

**AI 产品设计 / 独立开发｜2026.05-2026.06**

- 围绕 AI 修改简历过程不透明、用户难以判断改动依据与回退风险的问题，设计并开发本地优先的 AI 简历编辑器，将 React 简历预览、Electron 桌面 App、本地 bridge、MCP server 与终端 agent 串联成可审核工作流。
- 设计 “AI 提议 - 用户确认 - 再写入” 的 pending patch 机制：Codex / Claude / agy 只能通过 MCP 提交待确认文案，工作台展示 before/after diff，用户接受后才写入 `active-resume.json`，避免 AI 直接覆盖个人简历资产。
- 构建素材摄入链路，支持将 `.md/.txt`、文字版 PDF、Excel 表格抽取为 `materials/.extracted/*.md`，让 agent 基于真实实习材料和项目记录改写简历，而不是依赖空泛 prompt。
- 新增历史存档与新模板重塑能力：用户手动保存、打开新模板、恢复旧版本前均自动生成本地快照，降低针对不同岗位大幅重写简历时的丢稿风险。
- 完成桌面端打包、白色系产品介绍页、白色系 App 图标、MCP 接入文档与 GitHub 上传边界设计，重点验证 “本地数据可控、AI 修改可见、结果可回退” 的 AI 产品信任架构。
