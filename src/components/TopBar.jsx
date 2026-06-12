import { useState } from "react";

export default function TopBar({
  onSave,
  onOpenLatest,
  onOpenHistory,
  onNewResume,
  bridgeStatus,
  currentFileName,
  isDesktop,
  onExportPdf,
}) {
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const mcpReady = bridgeStatus.ok && bridgeStatus.runtimeReady;
  const mcpLabel = mcpReady ? "MCP Ready" : bridgeStatus.ok ? "MCP Starting" : "MCP Offline";

  const handleSave = async () => {
    setSaving(true);
    setNotice("");
    try {
      await onSave?.();
      setNotice("已保存");
    } catch (err) {
      console.error("Save failed:", err);
      setNotice(`保存失败：${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleExportPdf = async () => {
    setExporting(true);
    setNotice("");
    try {
      const filePath = await onExportPdf?.();
      setNotice(filePath ? `PDF 已导出` : "已取消导出");
    } catch (err) {
      console.error("PDF export failed:", err);
      setNotice(err.name === "ExportPreflightError" ? err.message : `PDF 导出失败：${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <header className="topbar" style={isDesktop ? { paddingLeft: "80px" } : {}}>
      <a className="brand" href="#">Resume Studio</a>
      <div className="topbar-actions">
        {isDesktop && <span className="desktop-pill">Desktop</span>}
        <span className={`bridge-pill ${mcpReady ? "ok" : ""}`}>
          <span className="bridge-dot" />
          {mcpLabel}
        </span>
        <button className="ghost" onClick={onNewResume}>新建模板</button>
        <button className="ghost" onClick={onOpenHistory}>历史</button>
        <button className="ghost" onClick={onOpenLatest}>打开</button>
        <button className="ghost" onClick={handleSave} disabled={saving}>
          {saving ? "保存中…" : "保存"}
        </button>
        <button className="primary" onClick={handleExportPdf} disabled={exporting}>
          {exporting ? "导出中…" : "导出 PDF"}
        </button>
      </div>
      {(notice || currentFileName) && (
        <div className="current-file">{notice || currentFileName}</div>
      )}
    </header>
  );
}
