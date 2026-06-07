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

const SPACING_PRESETS = [
  { id: "compact", label: "紧凑", lineHeight: 1.45, sectionGap: 8, entryGap: 6, pagePad: 28 },
  { id: "normal", label: "标准", lineHeight: 1.65, sectionGap: 14, entryGap: 10, pagePad: 36 },
  { id: "relaxed", label: "舒适", lineHeight: 1.85, sectionGap: 20, entryGap: 14, pagePad: 44 },
  { id: "airy", label: "宽松", lineHeight: 2.0, sectionGap: 26, entryGap: 18, pagePad: 52 },
];

export { FONT_OPTIONS, COLOR_SCHEMES, SPACING_PRESETS };

export default function StyleControls({
  fontId, onFontChange,
  colorId, onColorChange,
  spacingId, onSpacingChange
}) {
  return (
    <div className="style-controls">
      {/* Font picker */}
      <div className="style-group">
        <label className="style-label">字体</label>
        <div className="style-chips">
          {FONT_OPTIONS.map((f) => (
            <button
              key={f.id}
              className={`style-chip ${fontId === f.id ? "active" : ""}`}
              onClick={() => onFontChange(f.id)}
              style={{ fontFamily: f.family }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Color picker */}
      <div className="style-group">
        <label className="style-label">配色</label>
        <div className="style-chips">
          {COLOR_SCHEMES.map((c) => (
            <button
              key={c.id}
              className={`style-chip color-chip ${colorId === c.id ? "active" : ""}`}
              onClick={() => onColorChange(c.id)}
            >
              <span
                className="color-dot"
                style={{ background: c.heading }}
              />
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Spacing control */}
      <div className="style-group">
        <label className="style-label">间距</label>
        <div className="style-chips">
          {SPACING_PRESETS.map((s) => (
            <button
              key={s.id}
              className={`style-chip ${spacingId === s.id ? "active" : ""}`}
              onClick={() => onSpacingChange(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
