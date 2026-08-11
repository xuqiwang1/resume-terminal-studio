import { forwardRef, useMemo } from "react";
import { getTemplate } from "../templates/registry";
import { buildResumePageStyle } from "../lib/resumePageStyle";

/**
 * PrintView: A hidden, non-scaled A4 view used exclusively for PDF export.
 * It renders the same template component as the preview but at true A4 size
 * (210mm width), without any transform/scale. This guarantees PDF = preview.
 *
 * Visible only in @media print; hidden on screen.
 */
const PrintView = forwardRef(function PrintView({
  resume, templateId, fontId, colorId,
  lineHeight, sectionGap, pagePadding, fontSize,
  ruleStyle, avatar, avatarPos, layoutConfig, fieldStyles,
  adaptiveStyle = null,
}, ref) {
  const template = useMemo(() => getTemplate(templateId || "professional"), [templateId]);
  const TemplateComponent = template.Component;

  const effectiveStyle = adaptiveStyle || { lineHeight, sectionGap, pagePadding, fontSize };
  const pageStyle = buildResumePageStyle({ ...effectiveStyle, fontId, colorId, layoutConfig });

  const ctx = {
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

  return (
    <div className="print-view" aria-hidden="true">
      <div
        className={`print-page resume-page template-${template.id}${adaptiveStyle ? " auto-fit" : ""}`}
        ref={ref}
        style={pageStyle}
      >
        <div className="resume-content">
          <TemplateComponent resume={resume} ctx={ctx} />
        </div>
      </div>
    </div>
  );
});

export default PrintView;
