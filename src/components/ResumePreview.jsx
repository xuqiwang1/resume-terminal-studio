import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import { getTemplate } from "../templates/registry";
import { A4_PAGE_HEIGHT_PX, A4_PAGE_WIDTH_PX } from "../lib/a4Page";
import { buildResumePageStyle } from "../lib/resumePageStyle";

const AUTO_FIT_MIN_SCALE = 0.76;
const AUTO_FIT_MAX_SCALE = 1.6;
const AUTO_FIT_TARGET_RATIO = 0.99;
const AUTO_FIT_MAX_ITERATIONS = 16;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function roundTo(value, step = 0.5) {
  return Math.round(value / step) * step;
}

function buildAdaptiveStyle({ lineHeight, sectionGap, pagePadding, fontSize }, fitScale) {
  const typeCorrection = Math.pow(fitScale, 0.9);
  const spaceCorrection = Math.pow(fitScale, 0.7);
  const paddingCorrection = fitScale < 1 ? Math.pow(fitScale, 0.5) : Math.pow(fitScale, -0.25);

  return {
    fitScale: roundTo(fitScale, 0.001),
    lineHeight: clamp(roundTo(lineHeight * Math.max(0.84, Math.min(1.16, spaceCorrection)), 0.005), 1.2, 2.2),
    sectionGap: clamp(roundTo(sectionGap * Math.max(0.72, Math.min(1.4, spaceCorrection)), 0.5), 3, 32),
    pagePadding: clamp(roundTo(pagePadding * Math.max(0.78, Math.min(1.12, paddingCorrection)), 1), 16, 64),
    fontSize: {
      heading: clamp(roundTo(fontSize.heading * Math.max(0.76, Math.min(1.45, typeCorrection)), 0.01), 16, 34),
      body: clamp(roundTo(fontSize.body * Math.max(0.76, Math.min(1.45, typeCorrection)), 0.01), 8.5, 18),
      muted: clamp(roundTo(fontSize.muted * Math.max(0.76, Math.min(1.45, typeCorrection)), 0.01), 8, 14),
    }
  };
}

function sameStyle(a, b) {
  return a.lineHeight === b.lineHeight
    && a.sectionGap === b.sectionGap
    && a.pagePadding === b.pagePadding
    && a.fitScale === b.fitScale
    && a.fontSize.heading === b.fontSize.heading
    && a.fontSize.body === b.fontSize.body
    && a.fontSize.muted === b.fontSize.muted;
}

const ResumePreview = forwardRef(function ResumePreview({
  resume, activeSectionId, flashToken,
  selectedField, onSelectField, workingSection,
  patchAnimation, onPatchAnimationComplete,
  templateId, fontId, colorId,
  lineHeight, sectionGap, pagePadding, fontSize,
  ruleStyle, avatar, avatarPos, onAvatarPosChange,
  layoutConfig, fieldStyles, onViewChange,
  autoFit = false, adaptiveStyle = null, onAutoFitChange, onAdaptiveStyleChange
}, ref) {
  const containerRef = useRef(null);
  const [contentHeight, setContentHeight] = useState(0);
  const fitMeasureRef = useRef(null);
  const fitSearchRef = useRef(null);
  const fitBestRef = useRef(null);

  useImperativeHandle(ref, () => containerRef.current, []);

  const template = useMemo(() => getTemplate(templateId || "professional"), [templateId]);

  const baseStyle = useMemo(() => ({
    lineHeight,
    sectionGap,
    pagePadding,
    fontSize,
    fitScale: 1,
  }), [lineHeight, sectionGap, pagePadding, fontSize]);

  const [fitMeasureStyle, setFitMeasureStyle] = useState(baseStyle);
  const [fitSettled, setFitSettled] = useState(!autoFit);

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

  const effectiveStyle = autoFit && adaptiveStyle ? adaptiveStyle : baseStyle;

  useLayoutEffect(() => {
    fitSearchRef.current = {
      low: AUTO_FIT_MIN_SCALE,
      high: AUTO_FIT_MAX_SCALE,
      iterations: 0,
    };
    fitBestRef.current = null;
    setFitMeasureStyle(baseStyle);
    setFitSettled(!autoFit);
    if (!autoFit) onAdaptiveStyleChange?.(null);
  }, [baseStyle, resume, templateId, fontId, colorId, layoutConfig, fieldStyles, autoFit, onAdaptiveStyleChange]);

  useEffect(() => {
    const el = containerRef.current;
    const contentEl = el?.querySelector(".resume-content");
    if (!el || !contentEl) return;
    const measure = () => {
      const nextHeight = contentEl.scrollHeight;
      setContentHeight(nextHeight);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(contentEl);
    measure();
    return () => observer.disconnect();
  }, [resume, templateId, fontId, colorId, layoutConfig, fieldStyles, autoFit, effectiveStyle]);

  useEffect(() => {
    if (!autoFit) return;
    const measureRoot = fitMeasureRef.current;
    const contentEl = measureRoot?.querySelector(".resume-content");
    if (!contentEl) return;

    let frame = null;
    let stopped = false;
    const settle = () => {
      if (stopped) return;
      setFitSettled(true);
      onAdaptiveStyleChange?.(fitBestRef.current?.style || fitMeasureStyle);
    };
    const measure = () => {
      frame = null;
      if (stopped) return;
      const nextHeight = contentEl.scrollHeight;
      setContentHeight(nextHeight);
      const totalHeight = nextHeight + fitMeasureStyle.pagePadding * 2;
      const targetHeight = A4_PAGE_HEIGHT_PX * AUTO_FIT_TARGET_RATIO;
      const error = Math.abs(totalHeight - targetHeight);
      const currentCandidate = { style: fitMeasureStyle, error, totalHeight, fits: totalHeight <= targetHeight };
      const bestCandidate = fitBestRef.current;
      if (
        !bestCandidate
        || (currentCandidate.fits && (!bestCandidate.fits || currentCandidate.totalHeight > bestCandidate.totalHeight))
        || (!currentCandidate.fits && !bestCandidate.fits && currentCandidate.totalHeight < bestCandidate.totalHeight)
      ) {
        fitBestRef.current = currentCandidate;
      }
      const search = fitSearchRef.current || {
        low: AUTO_FIT_MIN_SCALE,
        high: AUTO_FIT_MAX_SCALE,
        iterations: 0,
      };
      if (
        search.iterations >= AUTO_FIT_MAX_ITERATIONS
        || search.high - search.low <= 0.001
      ) {
        settle();
        return;
      }
      if (currentCandidate.fits) {
        search.low = Math.max(search.low, fitMeasureStyle.fitScale);
      } else {
        search.high = Math.min(search.high, fitMeasureStyle.fitScale);
      }
      const nextScale = (search.low + search.high) / 2;
      const nextStyle = buildAdaptiveStyle(baseStyle, nextScale);
      search.iterations += 1;
      fitSearchRef.current = search;
      if (sameStyle(nextStyle, fitMeasureStyle)) {
        settle();
        return;
      }
      setFitSettled(false);
      setFitMeasureStyle(nextStyle);
    };
    const schedule = () => {
      if (frame || stopped) return;
      frame = requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(contentEl);
    schedule();
    return () => {
      stopped = true;
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [autoFit, baseStyle, fitMeasureStyle, resume, templateId, fontId, colorId, layoutConfig, fieldStyles, onAdaptiveStyleChange]);

  const totalContentHeight = contentHeight + effectiveStyle.pagePadding * 2;
  const overflowAmount = Math.max(0, Math.ceil(totalContentHeight - A4_PAGE_HEIGHT_PX));

  /*
   * Fit against a detached page so the visible A4 never participates in the
   * correction loop. The final style is committed only after the hidden page
   * reaches the target height.
   */
  const fitMeasureStyleForPage = buildResumePageStyle({
    ...fitMeasureStyle,
    fontId,
    colorId,
    layoutConfig,
  });

  const handleCanvasClick = useCallback(() => {
    onSelectField?.(null);
  }, [onSelectField]);

  const TemplateComponent = template.Component;
  const pageStyle = buildResumePageStyle({ ...effectiveStyle, fontId, colorId, layoutConfig });
  const pageHeight = A4_PAGE_HEIGHT_PX;

  const ctx = {
    activeSectionId, selectedField,
    onFieldClick: onSelectField, workingSection,
    patchAnimation, onPatchAnimationComplete,
    ruleStyle, avatar, avatarPos, onAvatarPosChange,
    layoutConfig, fieldStyles,
  };

  const fitCtx = {
    activeSectionId: null,
    selectedField: null,
    onFieldClick: null,
    workingSection: null,
    patchAnimation: null,
    onPatchAnimationComplete: null,
    ruleStyle,
    avatar,
    avatarPos,
    onAvatarPosChange: null,
    layoutConfig,
    fieldStyles,
  };

  // Start at true paper scale; users can switch to whole-page or width view.
  const [zoom, setZoom] = useState(1);
  const [scale, setScale] = useState(1);
  const canvasRef = useRef(null);

  const calculateScale = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const containerWidth = canvas.clientWidth;
    const containerHeight = canvas.clientHeight;

    if (zoom === "fit") {
      // Fit vertically: leave 80px padding (canvas has 36px * 2 = 72px padding, plus safety margin)
      const verticalScale = (containerHeight - 80) / A4_PAGE_HEIGHT_PX;
      setScale(Math.max(0.2, Math.min(2.0, verticalScale)));
    } else if (zoom === "width") {
      // Fit horizontally: leave a small margin so the page nearly fills the column
      const horizontalScale = (containerWidth - 24) / A4_PAGE_WIDTH_PX;
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
      const scaledA4Height = A4_PAGE_HEIGHT_PX * scale;
      const visiblePage = Math.max(1, Math.floor(canvas.scrollTop / Math.max(1, scaledA4Height)) + 1);
      const pageCount = Math.max(1, Math.ceil(totalContentHeight / A4_PAGE_HEIGHT_PX));
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
  }, [contentHeight, scale, zoom, onViewChange, totalContentHeight]);

  return (
    <section className="canvas-panel">
      <div className="resume-canvas" ref={canvasRef} onClick={handleCanvasClick}>
        <div
          className="resume-page-wrapper"
          style={{
            width: `${A4_PAGE_WIDTH_PX * scale}px`,
            height: `${pageHeight * scale}px`,
            position: "relative",
            overflow: "visible",
            flexShrink: 0
          }}
        >
          <div
            className={`resume-page template-${template.id}${autoFit ? " auto-fit" : ""}${autoFit && !fitSettled && !adaptiveStyle ? " auto-fitting" : ""}`}
            ref={containerRef}
            style={{
              ...pageStyle,
              position: "absolute",
              left: "50%",
              top: "0",
              transform: `translate(-50%, 0) scale(${scale})`,
              transformOrigin: "top center",
              margin: 0,
              height: `${pageHeight}px`
            }}
          >
            <div className="resume-content">
              <TemplateComponent resume={resume} ctx={ctx} />
            </div>
          </div>
        </div>

        {autoFit && (
          <div className="resume-fit-measure" ref={fitMeasureRef} aria-hidden="true">
            <div
              className={`resume-page fit-measure-page template-${template.id} auto-fit`}
              style={{
                ...fitMeasureStyleForPage,
                width: `${A4_PAGE_WIDTH_PX}px`,
                height: "auto",
                minHeight: 0,
                maxWidth: "none",
                margin: 0,
              }}
            >
              <div className="resume-content">
                <TemplateComponent resume={resume} ctx={fitCtx} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Floating Zoom Controls */}
      <div className="canvas-zoom-controls" onClick={(e) => e.stopPropagation()}>
        {overflowAmount > 0 && (
          <span className="page-overflow-warning">超出 A4 {overflowAmount}px</span>
        )}
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
          className={`zoom-mode-btn ${autoFit ? "active" : ""}`}
          aria-pressed={autoFit}
          onClick={() => onAutoFitChange?.(!autoFit)}
          title="根据内容变化自动调整 A4 密度"
        >
          自动适配
        </button>
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
