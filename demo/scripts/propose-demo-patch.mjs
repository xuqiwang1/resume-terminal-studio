const bridgeUrl = process.env.RESUME_BRIDGE_URL || "http://127.0.0.1:4318";

const improvedProjectText =
  "独立设计并开发本地优先的 AI 简历编辑工作台，将 Electron 桌面端、React A4 预览、本地 bridge、MCP server 与 pending patch 机制串成闭环；agent 可读取本地材料并提交改写建议，但正文写入必须经过 diff 审核、接受/拒绝和历史归档，验证了 human-reviewed AI writing 的可信交互模式。";

const response = await fetch(`${bridgeUrl}/api/patch/propose`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    patch: {
      sectionId: "projects",
      index: 0,
      field: "details",
      after: improvedProjectText
    }
  })
});

if (!response.ok) {
  throw new Error(`Bridge returned ${response.status}: ${await response.text()}`);
}

const text = await response.text();
process.stdout.write(text);
