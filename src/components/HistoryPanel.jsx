function formatArchiveDate(value) {
  if (!value) return "未知时间";
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function HistoryPanel({
  open,
  archives,
  onClose,
  onArchive,
  onOpenArchive,
}) {
  if (!open) return null;

  return (
    <aside className="history-panel" aria-label="简历历史存档">
      <div className="history-panel-head">
        <div>
          <p className="history-kicker">Resume history</p>
          <h2>历史存档</h2>
        </div>
        <button className="history-close" onClick={onClose} aria-label="关闭历史面板">
          ×
        </button>
      </div>

      <p className="history-copy">
        每次打开新模板或恢复旧版本前，Resume Studio 都会保留当前简历，方便你大胆重塑而不丢稿。
      </p>

      <button className="history-save-btn" onClick={onArchive}>
        保存当前版本
      </button>

      <div className="history-list">
        {archives?.length ? (
          archives.map((item) => (
            <article className="history-item" key={item.fileName}>
              <div>
                <p className="history-item-title">
                  {item.resume?.name || "未命名简历"}
                </p>
                <p className="history-item-meta">
                  {formatArchiveDate(item.archivedAt)} · {item.reason || "manual"}
                </p>
              </div>
              <button className="history-open-btn" onClick={() => onOpenArchive(item.fileName)}>
                恢复
              </button>
            </article>
          ))
        ) : (
          <div className="history-empty">
            <p>还没有历史版本。</p>
            <span>点击“保存当前版本”，或直接“新建模板”后会自动生成第一份快照。</span>
          </div>
        )}
      </div>
    </aside>
  );
}
