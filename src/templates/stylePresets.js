// A4 compact style presets, kept free of any JSX import so they can be loaded by
// bare `node` in tests and by pure helpers like src/lib/styleSettings.js.
// src/templates/registry.js attaches these to each template entry.

export const A4_COMPACT_PRESETS = {
  professional: {
    lineHeight: 1.32,
    sectionGap: 6,
    pagePadding: 24,
    fontSize: { heading: 19, body: 10, muted: 9 },
    ruleStyle: "thin"
  },
  editorial: {
    lineHeight: 1.35,
    sectionGap: 8,
    pagePadding: 24,
    fontSize: { heading: 22, body: 10, muted: 9 },
    ruleStyle: "thin"
  },
  classic: {
    lineHeight: 1.3,
    sectionGap: 6,
    pagePadding: 24,
    fontSize: { heading: 19, body: 10, muted: 9 },
    ruleStyle: "thin"
  }
};

export const DEFAULT_TEMPLATE_ID = "professional";

export function stylePresetFor(templateId) {
  return A4_COMPACT_PRESETS[templateId] || null;
}
