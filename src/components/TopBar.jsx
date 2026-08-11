import { useEffect, useRef, useState } from "react";

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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const mcpReady = bridgeStatus.ok && bridgeStatus.runtimeReady;
  const statusClass = mcpReady ? "ok" : bridgeStatus.ok ? "pending" : "";
  const statusTitle = mcpReady
    ? "已连接本地 bridge，AI 可提交待确认改动"
    : bridgeStatus.ok
      ? "bridge 正在启动"
      : "bridge 未连接，AI 无法提交改动";

  // Close the document menu on outside click or Escape so it never strands open
  // over the canvas.
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event) => {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const runMenuAction = async (action) => {
    setMenuOpen(false);
    setNotice("");
    try {
      await action?.();
    } catch (err) {
      setNotice(err.message);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setNotice("");
    try {
      await onSave?.();
      setNotice("已保存");
    } catch (err) {
      setNotice(`保存失败：${err.message}`);
    } finally {
      setSaving(false);
      setMenuOpen(false);
    }
  };

  const handleExportPdf = async () => {
    setExporting(true);
    setNotice("");
    try {
      const filePath = await onExportPdf?.();
      setNotice(filePath ? "PDF 已导出" : "已取消导出");
    } catch (err) {
      setNotice(err.name === "ExportPreflightError" ? err.message : `PDF 导出失败：${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <header className="topbar" style={isDesktop ? { paddingLeft: "80px" } : {}}>
      <a className="brand" href="#">
        <span className={`brand-status ${statusClass}`} title={statusTitle} />
        Resume Studio
      </a>

      {(notice || currentFileName) && (
        <div className="current-file">{notice || currentFileName}</div>
      )}

      <div className="topbar-actions">
        <div className="doc-menu" ref={menuRef}>
          <button
            className="ghost doc-menu-trigger"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            文档
          </button>
          {menuOpen && (
            <div className="doc-menu-list" role="menu">
              <button role="menuitem" onClick={handleSave} disabled={saving}>
                {saving ? "保存中…" : "保存"}
              </button>
              <button role="menuitem" onClick={() => runMenuAction(onOpenLatest)}>
                打开最近
              </button>
              <button role="menuitem" onClick={() => runMenuAction(onOpenHistory)}>
                历史版本
              </button>
              <div className="doc-menu-rule" />
              <button role="menuitem" onClick={() => runMenuAction(onNewResume)}>
                新建模板
              </button>
            </div>
          )}
        </div>

        <button className="primary" onClick={handleExportPdf} disabled={exporting}>
          {exporting ? "导出中…" : "导出 PDF"}
        </button>
      </div>
    </header>
  );
}
