// Section-level A4 overflow diagnosis.
//
// The page only ever reported a single number ("超出 A4 32px"), which tells the user
// that something is too long but not what to shorten. These helpers attribute the
// overflow to the sections that actually cross the bottom of the printable area.
//
// The geometry math is separated from the DOM read so it can be unit-tested with
// plain numbers.

import { SECTION_LABELS } from "../hooks/resumeStudioHelpers.js";

// A section is reported when its bottom edge passes the last printable pixel. The
// amount is how far past it goes, so the worst offender sorts first.
export function diagnoseSectionOverflow(sections, contentBottom) {
  if (!Array.isArray(sections) || !Number.isFinite(contentBottom)) return [];
  return sections
    .filter((section) => Number.isFinite(section?.bottom) && section.bottom > contentBottom)
    .map((section) => ({
      sectionId: section.sectionId,
      label: section.label || SECTION_LABELS[section.sectionId] || section.sectionId,
      overflowPx: Math.ceil(section.bottom - contentBottom),
      // True when the section starts below the fold too: it is entirely off the page,
      // which is a different fix (drop it, or shorten what precedes it).
      fullyBelow: Number.isFinite(section.top) ? section.top >= contentBottom : false
    }))
    .sort((a, b) => b.overflowPx - a.overflowPx);
}

// Reads the rendered page. `root` is the .resume-page element; every section carries
// data-section, so no template-specific knowledge is needed here.
export function readSectionGeometry(root) {
  if (!root?.querySelectorAll) return [];
  const rootTop = root.getBoundingClientRect().top;
  return Array.from(root.querySelectorAll("[data-section]")).map((el) => {
    const rect = el.getBoundingClientRect();
    return {
      sectionId: el.getAttribute("data-section"),
      top: rect.top - rootTop,
      bottom: rect.bottom - rootTop
    };
  });
}

export function measureSectionOverflow(root, { pageHeight, pagePadding }) {
  if (!root) return [];
  // box-sizing is border-box, so the page height already includes its padding: the
  // last printable pixel sits one padding above the bottom edge.
  const contentBottom = pageHeight - pagePadding;
  return diagnoseSectionOverflow(readSectionGeometry(root), contentBottom);
}

export function formatSectionOverflow(sections, limit = 3) {
  if (!sections?.length) return "";
  const shown = sections.slice(0, limit).map((s) => `${s.label} +${s.overflowPx}px`);
  const rest = sections.length - shown.length;
  return rest > 0 ? `${shown.join("、")} 等 ${sections.length} 处` : shown.join("、");
}
