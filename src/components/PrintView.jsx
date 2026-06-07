import { forwardRef, useMemo } from "react";
import { getTemplate } from "../templates/registry";
import { FONT_OPTIONS, COLOR_SCHEMES } from "./LeftStylePanel";

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
}, ref) {
  const template = useMemo(() => getTemplate(templateId || "professional"), [templateId]);
  const TemplateComponent = template.Component;

  const font = FONT_OPTIONS.find((f) => f.id === fontId) || FONT_OPTIONS[0];
  const color = COLOR_SCHEMES.find((c) => c.id === colorId) || COLOR_SCHEMES[0];

  const pageStyle = {
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

  const ctx = {
    activeSectionId: null,
    draftState: null,
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
        className={`print-page resume-page template-${template.id}`}
        ref={ref}
        style={pageStyle}
      >
        <TemplateComponent resume={resume} ctx={ctx} />
      </div>
    </div>
  );
});

export default PrintView;
