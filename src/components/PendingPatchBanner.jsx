import { computeTextDiff } from "../lib/textDiff";

const SECTION_LABELS = {
  summary: "个人总结",
  experience: "工作经历",
  projects: "项目经历",
  education: "教育背景",
  skills: "专业技能",
  title: "标题",
  contact: "联系方式"
};

const FIELD_LABELS = {
  school: "学校",
  degree: "学历",
  major: "专业",
  date: "时间",
  tag: "标签",
  company: "公司",
  role: "角色",
  details: "正文",
  category: "分类",
  content: "内容"
};

function DiffText({ before, after }) {
  const segments = computeTextDiff(before || "", after || "");
  return (
    <p className="pending-diff">
      {segments.map((seg, i) => {
        if (seg.type === "equal") return <span key={i}>{seg.text}</span>;
        if (seg.type === "delete") {
          return (
            <span key={i} className="pending-diff-del">
              {seg.text}
            </span>
          );
        }
        return (
          <span key={i} className="pending-diff-ins">
            {seg.text}
          </span>
        );
      })}
    </p>
  );
}

function formatValue(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

function changeLabel(change) {
  const sectionLabel = SECTION_LABELS[change.sectionId] || change.sectionId;
  if (change.operation === "append_item") return `新增${sectionLabel}`;
  if (change.operation === "replace_item") return `替换${sectionLabel}第 ${Number(change.index || 0) + 1} 条`;
  if (change.operation === "replace_field") {
    const fieldLabel = FIELD_LABELS[change.field] || change.field;
    return `修改${sectionLabel}第 ${Number(change.index || 0) + 1} 条${fieldLabel}`;
  }
  if (change.operation === "replace_section" && typeof change.index === "number") {
    const fieldLabel = FIELD_LABELS[change.field] || change.field;
    return `改写${sectionLabel}第 ${change.index + 1} 条${fieldLabel}`;
  }
  return `改写${sectionLabel}`;
}

function groupBatchChanges(changes = []) {
  const groups = [];
  for (const change of changes) {
    const sectionId = change.sectionId || "unknown";
    let group = groups.find((entry) => entry.sectionId === sectionId);
    if (!group) {
      group = {
        sectionId,
        label: SECTION_LABELS[sectionId] || sectionId,
        changes: []
      };
      groups.push(group);
    }
    group.changes.push(change);
  }
  return groups;
}

function BatchPendingView({ pending }) {
  const groupedChanges = groupBatchChanges(pending.changes);

  return (
    <div className="pending-batch">
      {pending.summary ? <p className="pending-batch-summary">{pending.summary}</p> : null}
      {groupedChanges.map((group) => (
        <div key={group.sectionId} className="pending-batch-group">
          <p className="pending-batch-group-title">{group.label}</p>
          <div className="pending-batch-changes">
            {group.changes.map((change, index) => (
              <div
                key={`${group.sectionId}-${change.operation}-${change.index ?? "append"}-${index}`}
                className="pending-batch-change"
              >
                <p className="pending-batch-change-label">{changeLabel(change)}</p>
                <DiffText before={formatValue(change.before)} after={formatValue(change.after)} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PendingPatchBanner({ pending, onConfirm, onReject }) {
  if (!pending) return null;

  const label =
    pending.kind === "batch"
      ? pending.title || "批量改动"
      : SECTION_LABELS[pending.sectionId] || pending.sectionId;

  return (
    <div className="pending-banner" role="alertdialog" aria-live="polite">
      <div className="pending-banner-head">
        <span className="pending-kicker">AI 待确认改动</span>
        <span className="pending-target">{label}</span>
      </div>
      {pending.instruction ? (
        <p className="pending-instruction">指令：{pending.instruction}</p>
      ) : null}
      {pending.kind === "batch" ? (
        <BatchPendingView pending={pending} />
      ) : (
        <DiffText before={pending.before} after={pending.after} />
      )}
      <div className="pending-actions">
        <button className="pending-btn pending-reject" onClick={onReject}>
          拒绝
        </button>
        <button className="pending-btn pending-accept" onClick={onConfirm}>
          接受改动
        </button>
      </div>
    </div>
  );
}
