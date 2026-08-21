import { useRef, useState } from "react";
import { TEMPLATE_REGISTRY } from "../templates/registry";
import { SECTION_LABELS, textForField } from "../hooks/resumeStudioHelpers";
import { LINK_STYLE_MODES, normalizeLinkStyle } from "../lib/linkStyle";
import { SECTION_NAMES, resolveSectionOrder } from "../templates/shared";

const FONT_OPTIONS = [
  { id: "system", label: "系统", family: "Inter, -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB', 'Noto Sans SC', 'Source Han Sans SC', 'Microsoft YaHei', sans-serif" },
  { id: "serif", label: "宋体", family: "'Noto Serif SC', 'Songti SC', 'SimSun', serif" },
  { id: "kai", label: "楷体", family: "'Kaiti SC', 'STKaiti', 'KaiTi', serif" },
];

const COLOR_SCHEMES = [
  { id: "black", label: "纯黑", heading: "#000000", body: "#111111", muted: "#555555" },
  { id: "charcoal", label: "炭灰", heading: "#1f2937", body: "#374151", muted: "#6b7280" },
];

const RULE_STYLES = [
  { id: "thick", label: "粗线" },
  { id: "thin", label: "细线" },
  { id: "double", label: "双线" },
  { id: "none", label: "无" },
];

export { FONT_OPTIONS, COLOR_SCHEMES };

function ChipGroup({ children }) {
  return <div className="lsp-chips">{children}</div>;
}

/* A collapsible section. "版式" decisions are made once and stay open; density
   and ornament are fiddled with repeatedly, so they collapse to keep the panel
   from reading as one flat wall of nine equal-weight controls. */
function Fold({ title, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`lsp-fold${open ? " open" : ""}`}>
      <button
        className="lsp-fold-head"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="lsp-fold-caret" aria-hidden="true" />
        {title}
      </button>
      {open && <div className="lsp-fold-body">{children}</div>}
    </div>
  );
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
          <option key={t.id} value={t.id}>{t.shortName || t.name}</option>
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
  layoutConfig, onLayoutConfigChange,
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
        <label className="lsp-label">配色</label>
        <ColorChips activeColorId={colorId} onPickColor={(c) => onColorChange(c.id)} />
      </div>

      <Fold title="字号">
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
      </Fold>

      <Fold title="密度">
        <div style={{ display: "grid", gap: 8, width: "100%" }}>
          <SliderRow label="行距" value={lineHeight.toFixed(2)}>
            <input
              type="range" className="lsp-slider"
              min={1.2} max={2.2} step={0.05}
              value={lineHeight}
              onChange={(e) => onLineHeightChange(+e.target.value)}
            />
          </SliderRow>
          <SliderRow label="区块" value={`${sectionGap}px`}>
            <input
              type="range" className="lsp-slider"
              min={4} max={32} step={1}
              value={sectionGap}
              onChange={(e) => onSectionGapChange(+e.target.value)}
            />
          </SliderRow>
          <SliderRow label="页边" value={`${pagePadding}px`}>
            <input
              type="range" className="lsp-slider"
              min={16} max={64} step={2}
              value={pagePadding}
              onChange={(e) => onPaddingChange(+e.target.value)}
            />
          </SliderRow>
        </div>
      </Fold>

      <Fold title="装饰">
        <div className="lsp-subgroup">
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
        <div className="lsp-subgroup">
          <label className="lsp-label">标头风格</label>
          <ChipGroup>
            {[
              { id: "line", label: "全宽细线" },
              { id: "bar", label: "左侧色块" },
              { id: "pill", label: "胶囊底色" },
              { id: "minimal", label: "纯粹文本" }
            ].map(({ id, label }) => (
              <button
                key={id}
                className={`lsp-chip ${(layoutConfig?.sectionHeadStyle || "line") === id ? "active" : ""}`}
                onClick={() => onLayoutConfigChange?.({
                  ...layoutConfig,
                  sectionHeadStyle: id
                })}
              >
                {label}
              </button>
            ))}
          </ChipGroup>
        </div>
        <LinkStyleInspector layoutConfig={layoutConfig} onLayoutConfigChange={onLayoutConfigChange} />
      </Fold>

      <SectionOrderInspector layoutConfig={layoutConfig} onLayoutConfigChange={onLayoutConfigChange} />
    </>
  );
}

function SectionOrderInspector({ layoutConfig, onLayoutConfigChange }) {
  const currentOrder = resolveSectionOrder(layoutConfig);
  const [draggedIndex, setDraggedIndex] = useState(null);

  const move = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= currentOrder.length) return;
    const nextOrder = [...currentOrder];
    const [moved] = nextOrder.splice(fromIndex, 1);
    nextOrder.splice(toIndex, 0, moved);
    onLayoutConfigChange?.({
      ...layoutConfig,
      sectionOrder: nextOrder
    });
  };

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== targetIndex) {
      move(draggedIndex, targetIndex);
    }
    setDraggedIndex(null);
  };

  return (
    <Fold title="模块排序" defaultOpen={false}>
      <div className="lsp-order-list">
        {currentOrder.map((sectionId, index) => (
          <div
            key={sectionId}
            className={`lsp-order-item${draggedIndex === index ? " dragging" : ""}`}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, index)}
          >
            <span className="lsp-order-handle" title="按住拖拽排序">⠿</span>
            <span className="lsp-order-label">{SECTION_NAMES[sectionId] || sectionId}</span>
            <div className="lsp-order-actions">
              <button
                type="button"
                className="lsp-order-btn"
                disabled={index === 0}
                onClick={() => move(index, index - 1)}
                title="上移"
              >
                ↑
              </button>
              <button
                type="button"
                className="lsp-order-btn"
                disabled={index === currentOrder.length - 1}
                onClick={() => move(index, index + 1)}
                title="下移"
              >
                ↓
              </button>
            </div>
          </div>
        ))}
      </div>
      <p className="lsp-hint" style={{ marginTop: 6 }}>可拖拽或点击箭头调整模块上下顺序</p>
    </Fold>
  );
}

function LinkStyleInspector({ layoutConfig, onLayoutConfigChange }) {
  const linkStyle = normalizeLinkStyle(layoutConfig?.linkStyle);
  const setLinkStyle = (patch) =>
    onLayoutConfigChange?.({
      ...layoutConfig,
      linkStyle: { ...linkStyle, ...patch }
    });

  return (
    <div className="lsp-subgroup">
      <label className="lsp-label">链接样式</label>
      <ChipGroup>
        {LINK_STYLE_MODES.map((mode) => (
          <button
            key={mode.id}
            className={`lsp-chip ${linkStyle.mode === mode.id ? "active" : ""}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setLinkStyle({ mode: mode.id })}
          >
            {mode.label}
          </button>
        ))}
      </ChipGroup>
      <label className="lsp-check">
        <input
          type="checkbox"
          checked={linkStyle.underline}
          onChange={(e) => setLinkStyle({ underline: e.target.checked })}
        />
        显示下划线
      </label>
    </div>
  );
}

function FieldInspector({
  fontId, colorId, textSelection, selectedField, onApplyInlineStyle, onApplyFieldStyle,
  resume, onUpdateFieldText
}) {
  const scopeText = textSelection ? "选中文字" : "选中字段";
  const rawText = (resume && selectedField) ? textForField(resume, selectedField) : "";
  const currentText = typeof rawText === "string" ? rawText : (rawText != null ? String(rawText) : "");
  const isMultiLine = currentText.length > 40 || currentText.includes("\n");

  return (
    <>
      {selectedField && (
        <div className="lsp-group">
          <label className="lsp-label">编辑内容 <span className="lsp-hint">（实时修改，无需AI）</span></label>
          {isMultiLine ? (
            <textarea
              className="lsp-text-editor"
              value={currentText}
              rows={4}
              onChange={(e) => onUpdateFieldText?.(selectedField, e.target.value)}
              placeholder="在此直接输入或修改文字..."
            />
          ) : (
            <input
              type="text"
              className="lsp-input-editor"
              value={currentText}
              onChange={(e) => onUpdateFieldText?.(selectedField, e.target.value)}
              placeholder="在此直接输入或修改文字..."
            />
          )}
        </div>
      )}
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

      {!textSelection && selectedField ? (
        <div className="lsp-group">
          <label className="lsp-label">字段链接</label>
          <ChipGroup>
            <button
              className="lsp-chip"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onApplyFieldStyle?.(selectedField, "linkColor", "#0645ad");
                onApplyFieldStyle?.(selectedField, "linkUnderline", true);
              }}
            >
              默认蓝色
            </button>
            <button
              className="lsp-chip"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onApplyFieldStyle?.(selectedField, "linkColor", "inherit")}
            >
              跟随字段
            </button>
            <button
              className="lsp-chip"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onApplyFieldStyle?.(selectedField, "linkUnderline", false)}
            >
              隐藏下划线
            </button>
          </ChipGroup>
        </div>
      ) : null}
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
      <label className="lsp-label">技能版式</label>
      <ChipGroup>
        {[
          { id: "block", label: "分行" },
          { id: "inline", label: "并排" },
          { id: "grid", label: "3列网格" }
        ].map(({ id, label }) => (
          <button
            key={id}
            className={`lsp-chip${(layoutConfig?.skills?.layout || "block") === id ? " active" : ""}`}
            onClick={() => onLayoutConfigChange?.({
              ...layoutConfig,
              skills: { ...(layoutConfig?.skills || {}), layout: id }
            })}
          >
            {label}
          </button>
        ))}
      </ChipGroup>
    </div>
  );
}

function HeaderInspector({ layoutConfig, onLayoutConfigChange }) {
  return (
    <div className="lsp-group">
      <label className="lsp-label">页眉对齐</label>
      <ChipGroup>
        {[
          { id: "center", label: "居中" },
          { id: "left", label: "靠左" }
        ].map(({ id, label }) => (
          <button
            key={id}
            className={`lsp-chip${(layoutConfig?.headerStyle || "center") === id ? " active" : ""}`}
            onClick={() => onLayoutConfigChange?.({
              ...layoutConfig,
              headerStyle: id
            })}
          >
            {label}
          </button>
        ))}
      </ChipGroup>
    </div>
  );
}

function SummaryInspector({ layoutConfig, onLayoutConfigChange }) {
  return (
    <div className="lsp-group">
      <label className="lsp-label">总结外观</label>
      <ChipGroup>
        {[
          { id: "card", label: "导读卡片" },
          { id: "plain", label: "极简文本" }
        ].map(({ id, label }) => (
          <button
            key={id}
            className={`lsp-chip${(layoutConfig?.summaryStyle || "card") === id ? " active" : ""}`}
            onClick={() => onLayoutConfigChange?.({
              ...layoutConfig,
              summaryStyle: id
            })}
          >
            {label}
          </button>
        ))}
      </ChipGroup>
    </div>
  );
}

function SectionHeadInspector({ layoutConfig, onLayoutConfigChange }) {
  return (
    <div className="lsp-group">
      <label className="lsp-label">标头风格</label>
      <ChipGroup>
        {[
          { id: "line", label: "全宽细线" },
          { id: "bar", label: "左侧色块" },
          { id: "pill", label: "胶囊底色" },
          { id: "minimal", label: "纯粹文本" }
        ].map(({ id, label }) => (
          <button
            key={id}
            className={`lsp-chip ${(layoutConfig?.sectionHeadStyle || "line") === id ? "active" : ""}`}
            onClick={() => onLayoutConfigChange?.({
              ...layoutConfig,
              sectionHeadStyle: id
            })}
          >
            {label}
          </button>
        ))}
      </ChipGroup>
    </div>
  );
}

function SectionInspector({ activeSectionId, layoutConfig, onLayoutConfigChange }) {
  if (!activeSectionId) return null;
  const isBodySection = activeSectionId !== "header";

  return (
    <>
      {activeSectionId === "header" && (
        <HeaderInspector layoutConfig={layoutConfig} onLayoutConfigChange={onLayoutConfigChange} />
      )}
      {activeSectionId === "summary" && (
        <SummaryInspector layoutConfig={layoutConfig} onLayoutConfigChange={onLayoutConfigChange} />
      )}
      {activeSectionId === "education" && (
        <EducationInspector layoutConfig={layoutConfig} onLayoutConfigChange={onLayoutConfigChange} />
      )}
      {activeSectionId === "skills" && (
        <SkillsInspector layoutConfig={layoutConfig} onLayoutConfigChange={onLayoutConfigChange} />
      )}
      {(activeSectionId === "experience" || activeSectionId === "projects") && (
        <div className="lsp-group">
          <label className="lsp-label">{SECTION_LABELS[activeSectionId]}</label>
          <div className="inspector-note">名称 / 角色 / 日期三列</div>
        </div>
      )}
      {isBodySection && (
        <SectionHeadInspector layoutConfig={layoutConfig} onLayoutConfigChange={onLayoutConfigChange} />
      )}
    </>
  );
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
  resume, onUpdateFieldText
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

      {hasFieldSelection ? (
        <FieldInspector
          fontId={fontId}
          colorId={colorId}
          textSelection={textSelection}
          selectedField={selectedField}
          onApplyInlineStyle={onApplyInlineStyle}
          onApplyFieldStyle={onApplyFieldStyle}
          resume={resume}
          onUpdateFieldText={onUpdateFieldText}
        />
      ) : (
        <DocumentInspector
          fontId={fontId}
          onFontChange={onFontChange}
          colorId={colorId}
          onColorChange={onColorChange}
          layoutConfig={layoutConfig}
          onLayoutConfigChange={onLayoutConfigChange}
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
        <Fold title="头像">
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
        </Fold>
      )}
    </aside>
  );
}
