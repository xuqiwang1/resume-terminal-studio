import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { getTemplate } from "../templates/registry";
import { FONT_OPTIONS, COLOR_SCHEMES } from "./LeftStylePanel";

function buildPageStyle({ fontId, colorId, lineHeight, sectionGap, pagePadding, fontSize }) {
  const font = FONT_OPTIONS.find((f) => f.id === fontId) || FONT_OPTIONS[0];
  const color = COLOR_SCHEMES.find((c) => c.id === colorId) || COLOR_SCHEMES[0];
  return {
    "--r-font": font.family,
    "--r-heading": color.heading,
    "--r-body": color.body,
    "--r-muted": color.muted,
    "--r-lh": lineHeight,
    "--r-sec-gap": `${sectionGap}px`,
    "--r-entry-gap": `${Math.max(4, sectionGap - 4)}px`,
    "--r-pad": `${pagePadding}px`,
    "--r-fs-heading": `${fontSize.heading}px`,
    "--r-fs-body": `${fontSize.body}px`,
    "--r-fs-muted": `${fontSize.muted}px`,
  };
}

const ResumePreview = forwardRef(function ResumePreview({
  resume, activeSectionId, flashToken, draftState,
  selectedField, onSelectField, workingSection,
  patchAnimation, onPatchAnimationComplete,
  templateId, fontId, colorId,
  lineHeight, sectionGap, pagePadding, fontSize,
  ruleStyle, avatar, avatarPos, onAvatarPosChange,
  layoutConfig, fieldStyles, onViewChange
}, ref) {
  const containerRef = useRef(null);
  const [contentHeight, setContentHeight] = useState(0);

  useImperativeHandle(ref, () => containerRef.current, []);

  const template = useMemo(() => getTemplate(templateId || "professional"), [templateId]);

  useEffect(() => {
    if (!flashToken) return;
    const sectionEl = containerRef.current?.querySelector(
      `[data-section="${flashToken.sectionId}"]`
    );
    if (!sectionEl) return;
    sectionEl.classList.remove("flash-update");
    void sectionEl.offsetWidth;
    sectionEl.classList.add("flash-update");
    sectionEl.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [flashToken]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setContentHeight(el.scrollHeight));
    observer.observe(el);
    setContentHeight(el.scrollHeight);
    return () => observer.disconnect();
  }, [resume, templateId, lineHeight, sectionGap, pagePadding, fontSize]);

  const handleCanvasClick = useCallback(() => {
    onSelectField?.(null);
  }, [onSelectField]);

  const TemplateComponent = template.Component;
  const pageStyle = buildPageStyle({ fontId, colorId, lineHeight, sectionGap, pagePadding, fontSize });
  const pageHeight = Math.max(1123, contentHeight);

  const ctx = {
    activeSectionId, draftState, selectedField,
    onFieldClick: onSelectField, workingSection,
    patchAnimation, onPatchAnimationComplete,
    ruleStyle, avatar, avatarPos, onAvatarPosChange,
    layoutConfig, fieldStyles,
  };

  const [zoom, setZoom] = useState("width");
  const [scale, setScale] = useState(1);
  const canvasRef = useRef(null);

  const calculateScale = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const containerWidth = canvas.clientWidth;
    const containerHeight = canvas.clientHeight;

    if (zoom === "fit") {
      // Fit vertically: leave 80px padding (canvas has 36px * 2 = 72px padding, plus safety margin)
      const verticalScale = (containerHeight - 80) / 1123;
      setScale(Math.max(0.2, Math.min(2.0, verticalScale)));
    } else if (zoom === "width") {
      // Fit horizontally: leave a small margin so the page nearly fills the column
      const horizontalScale = (containerWidth - 24) / 794;
      setScale(Math.max(0.2, Math.min(2.0, horizontalScale)));
    } else if (typeof zoom === "number") {
      setScale(zoom);
    }
  }, [zoom]);

  useEffect(() => {
    calculateScale();
  }, [zoom, calculateScale]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => {
      calculateScale();
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [calculateScale]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frame = null;
    const sync = () => {
      frame = null;
      const scaledA4Height = 1123 * scale;
      const visiblePage = Math.max(1, Math.floor(canvas.scrollTop / Math.max(1, scaledA4Height)) + 1);
      const pageCount = Math.max(1, Math.ceil(contentHeight / 1123));
      onViewChange?.({
        visiblePage,
        pageCount,
        scrollTop: canvas.scrollTop,
        zoom,
        scale
      });
    };
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(sync);
    };
    canvas.addEventListener("scroll", onScroll, { passive: true });
    sync();
    return () => {
      if (frame) cancelAnimationFrame(frame);
      canvas.removeEventListener("scroll", onScroll);
    };
  }, [contentHeight, scale, zoom, onViewChange]);

  return (
    <section className="canvas-panel">
      <div className="resume-canvas" ref={canvasRef} onClick={handleCanvasClick}>
        <div
          className="resume-page-wrapper"
          style={{
            width: `${794 * scale}px`,
            height: `${pageHeight * scale}px`,
            position: "relative",
            overflow: "visible",
            flexShrink: 0
          }}
        >
          <div
            className={`resume-page template-${template.id}`}
            ref={containerRef}
            style={{
              ...pageStyle,
              position: "absolute",
              left: "50%",
              top: "0",
              transform: `translate(-50%, 0) scale(${scale})`,
              transformOrigin: "top center",
              margin: 0
            }}
          >
            <TemplateComponent resume={resume} ctx={ctx} />
          </div>
        </div>
      </div>

      {/* Floating Zoom Controls */}
      <div className="canvas-zoom-controls" onClick={(e) => e.stopPropagation()}>
        <button
          className="zoom-btn"
          onClick={() => {
            if (typeof zoom === "number") {
              setZoom(Math.max(0.3, Number((zoom - 0.1).toFixed(1))));
            } else {
              setZoom(Math.max(0.3, Number((scale - 0.1).toFixed(1))));
            }
          }}
          title="缩小"
        >
          －
        </button>
        <span className="zoom-percentage">{Math.round(scale * 100)}%</span>
        <button
          className="zoom-btn"
          onClick={() => {
            if (typeof zoom === "number") {
              setZoom(Math.min(2.0, Number((zoom + 0.1).toFixed(1))));
            } else {
              setZoom(Math.min(2.0, Number((scale + 0.1).toFixed(1))));
            }
          }}
          title="放大"
        >
          ＋
        </button>
        <span className="zoom-divider" />
        <button
          className={`zoom-mode-btn ${zoom === "fit" ? "active" : ""}`}
          onClick={() => setZoom("fit")}
        >
          整页
        </button>
        <button
          className={`zoom-mode-btn ${zoom === "width" ? "active" : ""}`}
          onClick={() => setZoom("width")}
        >
          宽页
        </button>
        <button
          className={`zoom-mode-btn ${zoom === 1 ? "active" : ""}`}
          onClick={() => setZoom(1.0)}
        >
          100%
        </button>
      </div>
    </section>
  );
});

export default ResumePreview;
