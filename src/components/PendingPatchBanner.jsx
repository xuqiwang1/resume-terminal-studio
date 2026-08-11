import { useEffect, useState } from "react";
import { computeTextDiff } from "../lib/textDiff";
import {
  formatFieldLabel,
  formatPendingChangeFields,
  formatPendingChangeLabel,
  formatPendingValue,
  formatSectionLabel
} from "../hooks/resumeStudioHelpers";

function DiffText({ before, after, compact = false }) {
  const segments = computeTextDiff(before || "", after || "");
  return (
    <p className={`pending-diff${compact ? " compact" : ""}`}>
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

function PendingValueBlock({ label, value, sectionId }) {
  const entries = formatPendingValue(value, sectionId);
  if (entries.length === 0) return null;
  return (
    <div className="pending-value-block">
      <p className="pending-value-label">{label}</p>
      <div className="pending-value-content">
        {entries.map((entry, index) => (
          <div key={`${entry.label || "text"}-${index}`} className="pending-value-row">
            {entry.label ? <span>{entry.label}</span> : null}
            <p>{entry.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PendingChangeCard({ change }) {
  const fields = formatPendingChangeFields(change);
  const beforeEntries = formatPendingValue(change.before, change.sectionId);
  const afterEntries = formatPendingValue(change.after ?? change.value, change.sectionId);
  const canShowCompactDiff =
    beforeEntries.length === 1 &&
    afterEntries.length === 1 &&
    !beforeEntries[0].label &&
    !afterEntries[0].label;

  return (
    <div className="pending-change-card">
      <div className="pending-change-head">
        <p className="pending-batch-change-label">{formatPendingChangeLabel(change)}</p>
        {fields.length ? (
          <p className="pending-field-list">涉及字段：{fields.join("、")}</p>
        ) : null}
      </div>
      {canShowCompactDiff ? (
        <DiffText before={beforeEntries[0].text} after={afterEntries[0].text} compact />
      ) : (
        <div className="pending-value-grid">
          <PendingValueBlock label="修改前" value={change.before} sectionId={change.sectionId} />
          <PendingValueBlock label="修改后" value={change.after ?? change.value} sectionId={change.sectionId} />
        </div>
      )}
    </div>
  );
}

function groupBatchChanges(changes = []) {
  const groups = [];
  for (const change of changes) {
    const sectionId = change.sectionId || "unknown";
    let group = groups.find((entry) => entry.sectionId === sectionId);
    if (!group) {
      group = {
        sectionId,
        label: formatSectionLabel(sectionId),
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
              <PendingChangeCard
                key={`${group.sectionId}-${change.operation}-${change.index ?? "append"}-${index}`}
                change={change}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PendingEvidence({ evidence = [] }) {
  const items = evidence.filter((item) => item?.sourcePath && item?.label);
  if (items.length === 0) return null;

  return (
    <div className="pending-evidence">
      <p className="pending-evidence-title">依据材料</p>
      <div className="pending-evidence-list">
        {items.map((item, index) => (
          <div key={`${item.sourcePath}-${index}`} className="pending-evidence-item">
            <span className="pending-evidence-path">{item.sourcePath}</span>
            <span className="pending-evidence-label">{item.label}</span>
            {item.quote ? <span className="pending-evidence-quote">{item.quote}</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

// Shows exactly what the patch expected to find versus what is there now, so the user
// can tell whether their own edit is about to be discarded.
function PendingConflictNotice({ conflicts = [] }) {
  if (conflicts.length === 0) return null;

  return (
    <div className="pending-conflict">
      <p className="pending-conflict-title">原文已被修改（{conflicts.length} 处）</p>
      <p className="pending-conflict-note">
        以下内容在 AI 提出改动之后又变过。接受会用 AI 版本覆盖当前内容。
      </p>
      <div className="pending-conflict-list">
        {conflicts.map((conflict, index) => (
          <div key={`${conflict.sectionId}-${conflict.index}-${conflict.field}-${index}`} className="pending-conflict-item">
            <span className="pending-conflict-target">
              {formatSectionLabel(conflict.sectionId)}
              {typeof conflict.index === "number" ? ` · 第 ${conflict.index + 1} 条` : ""}
              {conflict.field ? ` · ${formatFieldLabel(conflict.field)}` : ""}
            </span>
            <PendingValueBlock label="AI 提出时的原文" value={conflict.expected} />
            <PendingValueBlock label="当前内容" value={conflict.actual} />
          </div>
        ))}
      </div>
    </div>
  );
}

function formatRiskLevel(riskLevel) {
  if (riskLevel === "high") return "高风险";
  if (riskLevel === "medium") return "中风险";
  return "低风险";
}

function getCheckpointSummary(pending) {
  const changeCount = pending.kind === "batch" ? pending.changes?.length || 0 : 1;
  const evidenceCount = pending.evidence?.length || 0;
  return { changeCount, evidenceCount };
}

export default function PendingPatchBanner({ pending, conflicts = [], onConfirm, onReject }) {
  const [highRiskAcknowledged, setHighRiskAcknowledged] = useState(false);
  const [conflictAcknowledged, setConflictAcknowledged] = useState(false);

  useEffect(() => {
    setHighRiskAcknowledged(false);
    setConflictAcknowledged(false);
  }, [pending?.id]);

  if (!pending) return null;

  const riskLevel = pending.riskLevel || "low";
  const isHighRisk = riskLevel === "high";
  // A conflict means the text this patch was written against is no longer there.
  // Accepting anyway is allowed, but it must be a deliberate second action.
  const hasConflict = conflicts.length > 0;
  const acceptDisabled = (isHighRisk && !highRiskAcknowledged) || (hasConflict && !conflictAcknowledged);
  const checkpoint = getCheckpointSummary(pending);
  const label =
    pending.kind === "batch"
      ? pending.title || "批量改动"
      : formatSectionLabel(pending.sectionId);

  const singleChange =
    pending.kind === "batch"
      ? null
      : {
          operation: "replace_field",
          sectionId: pending.sectionId,
          index: pending.index,
          field: pending.field,
          before: pending.before,
          after: pending.after
        };

  return (
    <div className="pending-banner" role="alertdialog" aria-live="polite">
      <div className="pending-banner-head">
        <div className="pending-head-main">
          <span className="pending-kicker">AI 待确认改动</span>
          <span className={`pending-risk pending-risk-${riskLevel}`}>{formatRiskLevel(riskLevel)}</span>
        </div>
        <span className="pending-target">{label}</span>
      </div>
      {riskLevel === "high" ? (
        <p className="pending-risk-note">本次会替换或新增整条结构化内容，请重点核对范围。</p>
      ) : null}
      {hasConflict ? <PendingConflictNotice conflicts={conflicts} /> : null}
      {pending.instruction ? (
        <p className="pending-instruction">指令：{pending.instruction}</p>
      ) : null}
      <div className="pending-body">
        {pending.kind === "batch" ? (
          <BatchPendingView pending={pending} />
        ) : (
          <PendingChangeCard change={singleChange} />
        )}
        <PendingEvidence evidence={pending.evidence} />
      </div>
      <div className="pending-checkpoints">
        <div className="pending-checkpoint-row">
          <span>变更</span>
          <strong>{checkpoint.changeCount} 项</strong>
        </div>
        <div className="pending-checkpoint-row">
          <span>来源</span>
          <strong>{checkpoint.evidenceCount > 0 ? `${checkpoint.evidenceCount} 条` : "未标注"}</strong>
        </div>
        {checkpoint.evidenceCount === 0 ? (
          <p className="pending-checkpoint-warning">本次改动没有来源材料标注，请按你的判断核对内容。</p>
        ) : null}
        {isHighRisk ? (
          <label className="pending-risk-confirm">
            <input
              type="checkbox"
              checked={highRiskAcknowledged}
              onChange={(event) => setHighRiskAcknowledged(event.target.checked)}
            />
            <span>已核对整条替换/新增范围</span>
          </label>
        ) : null}
        {hasConflict ? (
          <label className="pending-risk-confirm">
            <input
              type="checkbox"
              checked={conflictAcknowledged}
              onChange={(event) => setConflictAcknowledged(event.target.checked)}
            />
            <span>已知原文被改过，仍要用 AI 版本覆盖</span>
          </label>
        ) : null}
      </div>
      <div className="pending-actions">
        <button className="pending-btn pending-reject" onClick={onReject}>
          拒绝
        </button>
        <button
          className="pending-btn pending-accept"
          onClick={() => onConfirm?.({ force: hasConflict })}
          disabled={acceptDisabled}
        >
          {hasConflict ? "覆盖并接受" : "接受改动"}
        </button>
      </div>
    </div>
  );
}
