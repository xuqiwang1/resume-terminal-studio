import { useRef } from "react";
import { TEMPLATE_REGISTRY } from "../templates/registry";

const FONT_OPTIONS = [
  { id: "serif", label: "宋体", family: "'Noto Serif SC', 'Songti SC', 'SimSun', serif" },
  { id: "sans", label: "黑体", family: "'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif" },
  { id: "system", label: "系统", family: "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', sans-serif" },
  { id: "kai", label: "楷体", family: "'Kaiti SC', 'STKaiti', 'KaiTi', serif" },
  { id: "mono", label: "等宽", family: "'JetBrains Mono', 'SF Mono', 'Menlo', 'Noto Sans SC', monospace" },
];

const COLOR_SCHEMES = [
  { id: "black", label: "纯黑", heading: "#000000", body: "#111111", muted: "#555555" },
  { id: "charcoal", label: "炭灰", heading: "#1a1a1a", body: "#2d2d2d", muted: "#666666" },
  { id: "slate", label: "石板", heading: "#334155", body: "#475569", muted: "#94a3b8" },
  { id: "warm", label: "暖灰", heading: "#292524", body: "#44403c", muted: "#a8a29e" },
  { id: "soft", label: "柔灰", heading: "#374151", body: "#6b7280", muted: "#9ca3af" },
];

const RULE_STYLES = [
  { id: "thick", label: "粗线" },
  { id: "thin", label: "细线" },
  { id: "double", label: "双线" },
  { id: "none", label: "无" },
];

export { FONT_OPTIONS, COLOR_SCHEMES };

export default function LeftStylePanel({
  templateId, onChangeTemplate,
  fontId, onFontChange,
  colorId, onColorChange,
  lineHeight, onLineHeightChange,
  sectionGap, onSectionGapChange,
  pagePadding, onPaddingChange,
  fontSize, onFontSizeChange,
  ruleStyle, onRuleStyleChange,
  avatar, onAvatarChange,
  layoutConfig, onLayoutConfigChange,
  textSelection, selectedField, onApplyInlineStyle, onApplyFieldStyle,
}) {
  const fileRef = useRef(null);

  const handleAvatarUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onAvatarChange?.(reader.result);
    reader.readAsDataURL(file);
  };

  return (
    <aside className="left-style-panel">
      {/* Template */}
      <div className="lsp-group">
        <label className="lsp-label">模板</label>
        <select
          className="lsp-select"
          value={templateId}
          onChange={(e) => onChangeTemplate?.(e.target.value)}
        >
          {TEMPLATE_REGISTRY.map((t) => (
            <option key={t.id} value={t.id}>{t.name} — {t.description}</option>
          ))}
        </select>
      </div>

      {/* Font */}
      <div className="lsp-group">
        <label className="lsp-label">
          字体
          {(textSelection || selectedField) && (
            <span className="lsp-hint">
              {textSelection ? "（将应用到选中文字）" : "（将应用到选中字段）"}
            </span>
          )}
        </label>
        <div className="lsp-chips">
          {FONT_OPTIONS.map((f) => (
            <button
              key={f.id}
              className={`lsp-chip ${fontId === f.id ? "active" : ""}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                if (textSelection) {
                  onApplyInlineStyle?.(
                    textSelection.fieldId,
                    textSelection.startOffset,
                    textSelection.endOffset,
                    "fontFamily",
                    f.family
                  );
                } else if (selectedField) {
                  onApplyFieldStyle?.(selectedField, "fontFamily", f.family);
                } else {
                  onFontChange(f.id);
                }
              }}
              style={{ fontFamily: f.family }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Font Size */}
      <div className="lsp-group">
        <label className="lsp-label">字号</label>
        <div style={{ display: "grid", gap: 6, width: "100%" }}>
          <div className="lsp-slider-row">
            <span className="lsp-slider-value" style={{ minWidth: 32 }}>标题</span>
            <input
              type="range" className="lsp-slider"
              min={16} max={32} step={1}
              value={fontSize.heading}
              onChange={(e) => onFontSizeChange({ ...fontSize, heading: +e.target.value })}
            />
            <span className="lsp-slider-value">{fontSize.heading}</span>
          </div>
          <div className="lsp-slider-row">
            <span className="lsp-slider-value" style={{ minWidth: 32 }}>正文</span>
            <input
              type="range" className="lsp-slider"
              min={10} max={18} step={0.5}
              value={fontSize.body}
              onChange={(e) => onFontSizeChange({ ...fontSize, body: +e.target.value })}
            />
            <span className="lsp-slider-value">{fontSize.body}</span>
          </div>
          <div className="lsp-slider-row">
            <span className="lsp-slider-value" style={{ minWidth: 32 }}>注释</span>
            <input
              type="range" className="lsp-slider"
              min={8} max={14} step={0.5}
              value={fontSize.muted}
              onChange={(e) => onFontSizeChange({ ...fontSize, muted: +e.target.value })}
            />
            <span className="lsp-slider-value">{fontSize.muted}</span>
          </div>
        </div>
      </div>

      {/* Color */}
      <div className="lsp-group">
        <label className="lsp-label">
          配色
          {(textSelection || selectedField) && (
            <span className="lsp-hint">
              {textSelection ? "（将应用到选中文字）" : "（将应用到选中字段）"}
            </span>
          )}
        </label>
        <div className="lsp-chips">
          {COLOR_SCHEMES.map((c) => (
            <button
              key={c.id}
              className={`lsp-chip ${colorId === c.id ? "active" : ""}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                if (textSelection) {
                  onApplyInlineStyle?.(
                    textSelection.fieldId,
                    textSelection.startOffset,
                    textSelection.endOffset,
                    "color",
                    c.body
                  );
                } else if (selectedField) {
                  onApplyFieldStyle?.(selectedField, "color", c.body);
                } else {
                  onColorChange(c.id);
                }
              }}
            >
              <span className="lsp-color-dot" style={{ background: c.heading }} />
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Line Height */}
      <div className="lsp-group">
        <label className="lsp-label">行高</label>
        <div className="lsp-slider-row" style={{ width: "100%" }}>
          <input
            type="range" className="lsp-slider"
            min={1.2} max={2.2} step={0.05}
            value={lineHeight}
            onChange={(e) => onLineHeightChange(+e.target.value)}
          />
          <span className="lsp-slider-value">{lineHeight.toFixed(2)}</span>
        </div>
      </div>

      {/* Section Gap */}
      <div className="lsp-group">
        <label className="lsp-label">段距</label>
        <div className="lsp-slider-row" style={{ width: "100%" }}>
          <input
            type="range" className="lsp-slider"
            min={4} max={32} step={1}
            value={sectionGap}
            onChange={(e) => onSectionGapChange(+e.target.value)}
          />
          <span className="lsp-slider-value">{sectionGap}px</span>
        </div>
      </div>

      {/* Page Padding */}
      <div className="lsp-group">
        <label className="lsp-label">页边距</label>
        <div className="lsp-slider-row" style={{ width: "100%" }}>
          <input
            type="range" className="lsp-slider"
            min={16} max={64} step={2}
            value={pagePadding}
            onChange={(e) => onPaddingChange(+e.target.value)}
          />
          <span className="lsp-slider-value">{pagePadding}px</span>
        </div>
      </div>

      {/* Rule Style */}
      <div className="lsp-group">
        <label className="lsp-label">分隔线</label>
        <div className="lsp-chips">
          {RULE_STYLES.map((r) => (
            <button
              key={r.id}
              className={`lsp-chip ${ruleStyle === r.id ? "active" : ""}`}
              onClick={() => onRuleStyleChange(r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Layout Controls */}
      <div className="lsp-group">
        <label className="lsp-label">区块布局</label>
        <div style={{ display: "grid", gap: 8, width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: "11px", color: "var(--text-secondary)", minWidth: 48 }}>学校</span>
            <div className="lsp-chips">
              {["left", "center", "right"].map((v) => (
                <button
                  key={v}
                  className={`lsp-chip${(layoutConfig?.education?.schoolAlign || "center") === v ? " active" : ""}`}
                  onClick={() => onLayoutConfigChange?.({
                    ...layoutConfig,
                    education: { ...(layoutConfig?.education || {}), schoolAlign: v }
                  })}
                >
                  {v === "left" ? "左" : v === "center" ? "居中" : "右"}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: "11px", color: "var(--text-secondary)", minWidth: 48 }}>专业</span>
            <div className="lsp-chips">
              {["left", "center", "right"].map((v) => (
                <button
                  key={v}
                  className={`lsp-chip${(layoutConfig?.education?.majorAlign || "right") === v ? " active" : ""}`}
                  onClick={() => onLayoutConfigChange?.({
                    ...layoutConfig,
                    education: { ...(layoutConfig?.education || {}), majorAlign: v }
                  })}
                >
                  {v === "left" ? "左" : v === "center" ? "居中" : "右"}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: "11px", color: "var(--text-secondary)", minWidth: 48 }}>技能</span>
            <div className="lsp-chips">
              {["block", "inline"].map((v) => (
                <button
                  key={v}
                  className={`lsp-chip${(layoutConfig?.skills?.layout || "block") === v ? " active" : ""}`}
                  onClick={() => onLayoutConfigChange?.({
                    ...layoutConfig,
                    skills: { ...(layoutConfig?.skills || {}), layout: v }
                  })}
                >
                  {v === "block" ? "分行" : "并排"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Avatar */}
      <div className="lsp-group">
        <label className="lsp-label">头像</label>
        <div className="lsp-avatar-area">
          <div className="lsp-avatar-preview">
            {avatar
              ? <img src={avatar} alt="avatar" />
              : <span className="lsp-avatar-placeholder">+</span>
            }
          </div>
          <div>
            <button className="lsp-upload-btn" onClick={() => fileRef.current?.click()}>
              {avatar ? "更换" : "上传"}
            </button>
            {avatar && (
              <button className="lsp-upload-btn" style={{ marginLeft: 4 }} onClick={() => onAvatarChange?.(null)}>
                移除
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleAvatarUpload} />
        </div>
      </div>
    </aside>
  );
}
