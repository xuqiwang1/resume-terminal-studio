# Codex for Open Source 申请材料草稿

官方入口：[Codex for Open Source](https://openai.com/form/codex-for-oss/)

## 官方要求摘要

OpenAI 官方表单说明该计划面向 active open-source projects 的 maintainers。官方会看 repository usage、ecosystem importance、active maintenance evidence，例如 PR review、issue triage、release management。入选维护者可能获得 6 个月 ChatGPT Pro、Codex Security 条件访问和 API credits。

表单需要准备：

- First name / Last name
- ChatGPT 账号邮箱
- GitHub username，且 profile 需要 public
- GitHub repository URL，且 repository 需要 public
- 维护者角色：primary maintainer 或 core maintainer
- Why does this repository qualify? 最多 500 字符
- 是否需要 Codex Security / API credits
- OpenAI Organization ID
- How will you use API credits for your project? 最多 500 字符
- Anything else we should know? 最多 500 字符

## 当前项目申请判断

Resume Studio 可以申请，但刚发布时缺少 stars、downloads、issue/PR/release 证据。更稳妥的节奏是：

1. 先公开 GitHub 仓库。
2. 补齐 README、demo 截图、release tag、license、security notes。
3. 连续维护 2-4 周，留下 commits、issues、release notes。
4. 再申请，强调本项目对“本地优先 agent 工作流”和“人审 AI 写入”的实验价值。

## 项目定位英文草稿

Resume Studio is an open-source local-first resume editing workbench that connects desktop resume preview, local materials ingestion, MCP-compatible terminal agents, human-reviewed patch flow, version history, and PDF export. It helps users collaborate with AI agents on personal resume content without giving agents silent write access to the resume file.

## Why does this repository qualify? 500 字符内草稿

Resume Studio explores a local-first MCP workflow for personal documents: terminal agents can read extracted materials and propose resume edits, but every AI-written change is staged as a human-reviewed diff before it touches the resume. The project is useful for developers building safe agent workflows around private files, local bridges, and audit-first UX.

## How will you use API credits? 500 字符内草稿

I would use API credits to build and test maintainer workflows for Resume Studio: PR review, security checks around local file access, release-note generation, and optional agent examples that demonstrate safe propose/confirm/reject flows without uploading private resume data by default.

## Anything else we should know? 500 字符内草稿

This project is intentionally not another black-box resume generator. It focuses on trust architecture for AI-assisted document editing: local workspace, explicit MCP tools, pending patches, history snapshots, and user confirmation before writes. I am the primary maintainer and plan to keep the repo public with clear docs and reproducible releases.
