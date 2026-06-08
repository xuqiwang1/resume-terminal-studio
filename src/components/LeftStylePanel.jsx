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

const SECTION_LABELS = {
  summary: "个人总结",
  header: "页眉",
  education: "教育背景",
  experience: "实习经历",
  projects: "项目经历",
  skills: "专业技能",
};

export { FONT_OPTIONS, COLOR_SCHEMES };

function ChipGroup({ children }) {
  return <div className="lsp-chips">{children}</div>;
}

function SliderRow({ label, value, children }) {
  return (
    <div className="lsp-slider-row">
      {label && <span className="lsp-slider-value" style={{ minWidth: 32 }}>{label}</span>}
      {children}
      <span className="lsp-slider-value">{value}</span>
    </div>
  );
}

function CurrentSelectionSummary({ selectedField, activeSectionId }) {
  const sectionLabel = SECTION_LABELS[activeSectionId] || "整份文档";
  return (
    <div className="lsp-group inspector-current">
      <label className="lsp-label">当前选择</label>
      <div className="inspector-current-card">
        <strong>{selectedField || sectionLabel}</strong>
        <span>{selectedField ? "字段属性已同步给 MCP context" : "未选中字段，显示文档属性"}</span>
      </div>
    </div>
  );
}

function TemplatePicker({ templateId, onChangeTemplate }) {
  return (
    <div className="lsp-group">
      <label className="lsp-label">文档</label>
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
  );
}

function FontChips({ activeFontId, onPickFont }) {
  return (
    <ChipGroup>
      {FONT_OPTIONS.map((f) => (
        <button
          key={f.id}
          className={`lsp-chip ${activeFontId === f.id ? "active" : ""}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPickFont(f)}
          style={{ fontFamily: f.family }}
        >
          {f.label}
        </button>
      ))}
    </ChipGroup>
  );
}

function ColorChips({ activeColorId, onPickColor }) {
  return (
    <ChipGroup>
      {COLOR_SCHEMES.map((c) => (
        <button
          key={c.id}
          className={`lsp-chip ${activeColorId === c.id ? "active" : ""}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPickColor(c)}
        >
          <span className="lsp-color-dot" style={{ background: c.heading }} />
          {c.label}
        </button>
      ))}
    </ChipGroup>
  );
}

function DocumentInspector({
  fontId, onFontChange,
  colorId, onColorChange,
  lineHeight, onLineHeightChange,
  sectionGap, onSectionGapChange,
  pagePadding, onPaddingChange,
  fontSize, onFontSizeChange,
  ruleStyle, onRuleStyleChange,
}) {
  return (
    <>
      <div className="lsp-group">
        <label className="lsp-label">全局字体</label>
        <FontChips activeFontId={fontId} onPickFont={(f) => onFontChange(f.id)} />
      </div>

      <div className="lsp-group">
        <label className="lsp-label">字号</label>
        <div style={{ display: "grid", gap: 6, width: "100%" }}>
          <SliderRow label="标题" value={fontSize.heading}>
            <input
              type="range" className="lsp-slider"
              min={16} max={32} step={1}
              value={fontSize.heading}
              onChange={(e) => onFontSizeChange({ ...fontSize, heading: +e.target.value })}
            />
          </SliderRow>
          <SliderRow label="正文" value={fontSize.body}>
            <input
              type="range" className="lsp-slider"
              min={10} max={18} step={0.5}
              value={fontSize.body}
              onChange={(e) => onFontSizeChange({ ...fontSize, body: +e.target.value })}
            />
          </SliderRow>
          <SliderRow label="注释" value={fontSize.muted}>
            <input
              type="range" className="lsp-slider"
              min={8} max={14} step={0.5}
              value={fontSize.muted}
              onChange={(e) => onFontSizeChange({ ...fontSize, muted: +e.target.value })}
            />
          </SliderRow>
        </div>
      </div>

      <div className="lsp-group">
        <label className="lsp-label">配色</label>
        <ColorChips activeColorId={colorId} onPickColor={(c) => onColorChange(c.id)} />
      </div>

      <div className="lsp-group">
        <label className="lsp-label">密度</label>
        <div style={{ display: "grid", gap: 8, width: "100%" }}>
          <SliderRow value={lineHeight.toFixed(2)}>
            <input
              type="range" className="lsp-slider"
              min={1.2} max={2.2} step={0.05}
              value={lineHeight}
              onChange={(e) => onLineHeightChange(+e.target.value)}
            />
          </SliderRow>
          <SliderRow value={`${sectionGap}px`}>
            <input
              type="range" className="lsp-slider"
              min={4} max={32} step={1}
              value={sectionGap}
              onChange={(e) => onSectionGapChange(+e.target.value)}
            />
          </SliderRow>
          <SliderRow value={`${pagePadding}px`}>
            <input
              type="range" className="lsp-slider"
              min={16} max={64} step={2}
              value={pagePadding}
              onChange={(e) => onPaddingChange(+e.target.value)}
            />
          </SliderRow>
        </div>
      </div>

      <div className="lsp-group">
        <label className="lsp-label">分隔线</label>
        <ChipGroup>
          {RULE_STYLES.map((r) => (
            <button
              key={r.id}
              className={`lsp-chip ${ruleStyle === r.id ? "active" : ""}`}
              onClick={() => onRuleStyleChange(r.id)}
            >
              {r.label}
            </button>
          ))}
        </ChipGroup>
      </div>
    </>
  );
}

function FieldInspector({
  fontId, colorId, textSelection, selectedField, onApplyInlineStyle, onApplyFieldStyle
}) {
  const scopeText = textSelection ? "选中文字" : "选中字段";
  return (
    <>
      <div className="lsp-group">
        <label className="lsp-label">字段字体 <span className="lsp-hint">（{scopeText}）</span></label>
        <FontChips
          activeFontId={fontId}
          onPickFont={(f) => {
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
            }
          }}
        />
      </div>

      <div className="lsp-group">
        <label className="lsp-label">字段颜色 <span className="lsp-hint">（{scopeText}）</span></label>
        <ColorChips
          activeColorId={colorId}
          onPickColor={(c) => {
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
            }
          }}
        />
      </div>
    </>
  );
}

function EducationInspector({ layoutConfig, onLayoutConfigChange }) {
  const setEducationLayout = (patch) =>
    onLayoutConfigChange?.({
      ...layoutConfig,
      education: { ...(layoutConfig?.education || {}), ...patch }
    });

  return (
    <div className="lsp-group">
      <label className="lsp-label">教育区块</label>
      <div style={{ display: "grid", gap: 8, width: "100%" }}>
        <div className="inspector-row">
          <span>学校</span>
          <ChipGroup>
            {["left", "center", "right"].map((v) => (
              <button
                key={v}
                className={`lsp-chip${(layoutConfig?.education?.schoolAlign || "center") === v ? " active" : ""}`}
                onClick={() => setEducationLayout({ schoolAlign: v })}
              >
                {v === "left" ? "左" : v === "center" ? "居中" : "右"}
              </button>
            ))}
          </ChipGroup>
        </div>
        <div className="inspector-row">
          <span>专业</span>
          <ChipGroup>
            {["left", "center", "right"].map((v) => (
              <button
                key={v}
                className={`lsp-chip${(layoutConfig?.education?.majorAlign || "right") === v ? " active" : ""}`}
                onClick={() => setEducationLayout({ majorAlign: v })}
              >
                {v === "left" ? "左" : v === "center" ? "居中" : "右"}
              </button>
            ))}
          </ChipGroup>
        </div>
      </div>
    </div>
  );
}

function SkillsInspector({ layoutConfig, onLayoutConfigChange }) {
  return (
    <div className="lsp-group">
      <label className="lsp-label">技能区块</label>
      <ChipGroup>
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
      </ChipGroup>
    </div>
  );
}

function SectionInspector({ activeSectionId, layoutConfig, onLayoutConfigChange }) {
  if (activeSectionId === "education") {
    return <EducationInspector layoutConfig={layoutConfig} onLayoutConfigChange={onLayoutConfigChange} />;
  }
  if (activeSectionId === "skills") {
    return <SkillsInspector layoutConfig={layoutConfig} onLayoutConfigChange={onLayoutConfigChange} />;
  }
  if (activeSectionId === "experience" || activeSectionId === "projects") {
    return (
      <div className="lsp-group">
        <label className="lsp-label">{SECTION_LABELS[activeSectionId]}</label>
        <div className="inspector-note">
          当前区块使用名称 / 角色 / 日期三列排列。点击具体字段后可调整字体、字号和颜色。
        </div>
      </div>
    );
  }
  return null;
}

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
  textSelection, selectedField, activeSectionId,
  onApplyInlineStyle, onApplyFieldStyle,
}) {
  const fileRef = useRef(null);
  const hasFieldSelection = Boolean(selectedField);

  const handleAvatarUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onAvatarChange?.(reader.result);
    reader.readAsDataURL(file);
  };

  return (
    <aside className="left-style-panel">
      <TemplatePicker templateId={templateId} onChangeTemplate={onChangeTemplate} />
      <CurrentSelectionSummary selectedField={selectedField} activeSectionId={activeSectionId} />

      {hasFieldSelection ? (
        <FieldInspector
          fontId={fontId}
          colorId={colorId}
          textSelection={textSelection}
          selectedField={selectedField}
          onApplyInlineStyle={onApplyInlineStyle}
          onApplyFieldStyle={onApplyFieldStyle}
        />
      ) : (
        <DocumentInspector
          fontId={fontId}
          onFontChange={onFontChange}
          colorId={colorId}
          onColorChange={onColorChange}
          lineHeight={lineHeight}
          onLineHeightChange={onLineHeightChange}
          sectionGap={sectionGap}
          onSectionGapChange={onSectionGapChange}
          pagePadding={pagePadding}
          onPaddingChange={onPaddingChange}
          fontSize={fontSize}
          onFontSizeChange={onFontSizeChange}
          ruleStyle={ruleStyle}
          onRuleStyleChange={onRuleStyleChange}
        />
      )}

      <SectionInspector
        activeSectionId={activeSectionId}
        layoutConfig={layoutConfig}
        onLayoutConfigChange={onLayoutConfigChange}
      />

      {!hasFieldSelection && (
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
              <p className="lsp-hint" style={{ marginTop: 8 }}>头像上传后可在预览中拖动定位。</p>
            </div>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleAvatarUpload} />
          </div>
        </div>
      )}
    </aside>
  );
}
