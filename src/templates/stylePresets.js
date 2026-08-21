// A4 compact style presets, kept free of any JSX import so they can be loaded by
// bare `node` in tests and by pure helpers like src/lib/styleSettings.js.
// src/templates/registry.js attaches these to each template entry.

export const A4_COMPACT_PRESETS = {
  professional: {
    fontId: "serif",
    colorId: "black",
    lineHeight: 1.32,
    sectionGap: 6,
    pagePadding: 24,
    fontSize: { heading: 19, body: 10, muted: 9 },
    ruleStyle: "thin"
  },
  classic: {
    fontId: "serif",
    colorId: "black",
    lineHeight: 1.3,
    sectionGap: 6,
    pagePadding: 24,
    fontSize: { heading: 19, body: 10, muted: 9 },
    ruleStyle: "thin"
  },
  modern: {
    fontId: "system",
    colorId: "charcoal",
    lineHeight: 1.4,
    sectionGap: 8,
    pagePadding: 24,
    fontSize: { heading: 20, body: 10.5, muted: 9.5 },
    ruleStyle: "thin"
  },
  executive: {
    fontId: "system",
    colorId: "charcoal",
    lineHeight: 1.42,
    sectionGap: 8,
    pagePadding: 24,
    fontSize: { heading: 20, body: 10.5, muted: 9.5 },
    ruleStyle: "thin"
  }
};

export const DEFAULT_TEMPLATE_ID = "professional";

export function stylePresetFor(templateId) {
  return A4_COMPACT_PRESETS[templateId] || null;
}
