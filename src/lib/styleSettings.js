// Document style settings — the presentation half of a resume document.
//
// These used to live as eight independent pieces of React state, which meant they
// were rebuilt from the template preset on every launch and silently lost. They now
// travel inside the resume object under `styleSettings`, the same way avatar and
// layoutConfig do, so one save persists content and presentation together.
//
// Everything here is pure so it can be unit-tested without React.

import { DEFAULT_TEMPLATE_ID as PRESET_DEFAULT_TEMPLATE_ID, stylePresetFor } from "../templates/stylePresets.js";

export const DEFAULT_TEMPLATE_ID = PRESET_DEFAULT_TEMPLATE_ID;

export const STYLE_LIMITS = {
  lineHeight: { min: 1, max: 2.4 },
  sectionGap: { min: 0, max: 48 },
  pagePadding: { min: 0, max: 96 },
  heading: { min: 10, max: 48 },
  body: { min: 6, max: 24 },
  muted: { min: 6, max: 24 }
};

const RULE_STYLES = ["thin", "bold", "none"];

function clamp(value, { min, max }, fallback) {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

// The preset is the floor for any value we cannot trust, so a corrupt or
// partially-written file degrades to a usable page instead of NaN geometry.
export function styleSettingsFromPreset(templateId = DEFAULT_TEMPLATE_ID, base = {}) {
  const preset = stylePresetFor(templateId) || stylePresetFor(DEFAULT_TEMPLATE_ID);
  return {
    templateId,
    fontId: base.fontId || "serif",
    colorId: base.colorId || "black",
    lineHeight: preset.lineHeight,
    sectionGap: preset.sectionGap,
    pagePadding: preset.pagePadding,
    fontSize: { ...preset.fontSize },
    ruleStyle: preset.ruleStyle
  };
}

export const DEFAULT_STYLE_SETTINGS = styleSettingsFromPreset(DEFAULT_TEMPLATE_ID);

export function normalizeStyleSettings(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const templateId = typeof source.templateId === "string" && source.templateId
    ? source.templateId
    : DEFAULT_TEMPLATE_ID;
  const preset = styleSettingsFromPreset(templateId);
  const fontSize = source.fontSize && typeof source.fontSize === "object" ? source.fontSize : {};

  return {
    templateId: stylePresetFor(templateId) ? templateId : DEFAULT_TEMPLATE_ID,
    fontId: typeof source.fontId === "string" && source.fontId ? source.fontId : preset.fontId,
    colorId: typeof source.colorId === "string" && source.colorId ? source.colorId : preset.colorId,
    lineHeight: clamp(source.lineHeight, STYLE_LIMITS.lineHeight, preset.lineHeight),
    sectionGap: clamp(source.sectionGap, STYLE_LIMITS.sectionGap, preset.sectionGap),
    pagePadding: clamp(source.pagePadding, STYLE_LIMITS.pagePadding, preset.pagePadding),
    fontSize: {
      heading: clamp(fontSize.heading, STYLE_LIMITS.heading, preset.fontSize.heading),
      body: clamp(fontSize.body, STYLE_LIMITS.body, preset.fontSize.body),
      muted: clamp(fontSize.muted, STYLE_LIMITS.muted, preset.fontSize.muted)
    },
    ruleStyle: RULE_STYLES.includes(source.ruleStyle) ? source.ruleStyle : preset.ruleStyle
  };
}

// Switching templates used to overwrite every numeric style with the new preset,
// discarding deliberate adjustments. A value that already differs from the outgoing
// template's preset was set by the user, so it survives the switch; everything still
// sitting at the old default moves to the new one.
export function applyTemplatePreset(current, nextTemplateId) {
  const settings = normalizeStyleSettings(current);
  const fromPreset = styleSettingsFromPreset(settings.templateId);
  const toPreset = styleSettingsFromPreset(nextTemplateId);

  const carry = (key) => (settings[key] === fromPreset[key] ? toPreset[key] : settings[key]);
  const carrySize = (key) =>
    settings.fontSize[key] === fromPreset.fontSize[key] ? toPreset.fontSize[key] : settings.fontSize[key];

  return {
    ...settings,
    templateId: nextTemplateId,
    lineHeight: carry("lineHeight"),
    sectionGap: carry("sectionGap"),
    pagePadding: carry("pagePadding"),
    ruleStyle: carry("ruleStyle"),
    fontSize: {
      heading: carrySize("heading"),
      body: carrySize("body"),
      muted: carrySize("muted")
    }
  };
}

// True when two settings objects would render identically. Used to keep autosave
// from writing on re-renders that did not actually change presentation.
export function styleSettingsEqual(a, b) {
  const left = normalizeStyleSettings(a);
  const right = normalizeStyleSettings(b);
  return (
    left.templateId === right.templateId &&
    left.fontId === right.fontId &&
    left.colorId === right.colorId &&
    left.lineHeight === right.lineHeight &&
    left.sectionGap === right.sectionGap &&
    left.pagePadding === right.pagePadding &&
    left.ruleStyle === right.ruleStyle &&
    left.fontSize.heading === right.fontSize.heading &&
    left.fontSize.body === right.fontSize.body &&
    left.fontSize.muted === right.fontSize.muted
  );
}
