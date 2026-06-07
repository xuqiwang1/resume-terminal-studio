function ActivityLog({ items }) {
  return (
    <div className="activity-log">
      {items.map((item, index) => (
        <div className="activity-item" key={`${item.label}-${index}`}>
          <div className="activity-meta">
            <span>{item.label}</span>
            <span className="state">{item.state}</span>
          </div>
          <p>{item.text}</p>
        </div>
      ))}
    </div>
  );
}

function DiffView({ before, after }) {
  if (!before || !after) return null;
  return (
    <div className="diff-block">
      <div className="diff-before">
        <strong>修改前</strong>
        <div>{before}</div>
      </div>
      <div className="diff-after">
        <strong>修改后</strong>
        <div>{after}</div>
      </div>
    </div>
  );
}

export default function ActivityPanel({
  actions,
  onRunAction,
  activityItems,
  diff
}) {
  return (
    <aside className="panel right-panel">
      <div className="panel-head">
        <span className="panel-kicker">Agent Actions</span>
        <h3>本次操作</h3>
      </div>
      <div className="action-group">
        {actions.map((action) => (
          <button
            key={action.id}
            className="action-btn"
            onClick={() => onRunAction(action.id)}
          >
            {action.label}
          </button>
        ))}
      </div>

      <div className="diff-wrap">
        <div className="panel-head compact">
          <span className="panel-kicker">Live Activity</span>
          <h3>实时变化</h3>
        </div>
        <div className="diff-card">
          <ActivityLog items={activityItems} />
          <DiffView before={diff.before} after={diff.after} />
        </div>
      </div>
    </aside>
  );
}
