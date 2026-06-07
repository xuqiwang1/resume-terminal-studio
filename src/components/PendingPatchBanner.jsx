import { computeTextDiff } from "../lib/textDiff";

const SECTION_LABELS = {
  summary: "个人总结",
  experience: "工作经历",
  projects: "项目经历",
  title: "标题",
  contact: "联系方式"
};

function DiffText({ before, after }) {
  const segments = computeTextDiff(before || "", after || "");
  return (
    <p className="pending-diff">
      {segments.map((seg, i) => {
        if (seg.type === "equal") return <span key={i}>{seg.text}</span>;
        if (seg.type === "delete")
          return (
            <span key={i} className="pending-diff-del">
              {seg.text}
            </span>
          );
        return (
          <span key={i} className="pending-diff-ins">
            {seg.text}
          </span>
        );
      })}
    </p>
  );
}

export default function PendingPatchBanner({ pending, onConfirm, onReject }) {
  if (!pending) return null;

  const label = SECTION_LABELS[pending.sectionId] || pending.sectionId;

  return (
    <div className="pending-banner" role="alertdialog" aria-live="polite">
      <div className="pending-banner-head">
        <span className="pending-kicker">AI 待确认改动</span>
        <span className="pending-target">{label}</span>
      </div>
      {pending.instruction ? (
        <p className="pending-instruction">指令：{pending.instruction}</p>
      ) : null}
      <DiffText before={pending.before} after={pending.after} />
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
