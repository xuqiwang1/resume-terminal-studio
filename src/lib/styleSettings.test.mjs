import assert from "node:assert/strict";
import {
  DEFAULT_STYLE_SETTINGS,
  applyTemplatePreset,
  normalizeStyleSettings,
  styleSettingsEqual,
  styleSettingsFromPreset
} from "./styleSettings.js";

// Unlike the source-string template checks, these exercise the real functions —
// style settings are pure data, so they can be asserted directly.

// Defaults come from the template preset, not from hardcoded numbers.
const professional = styleSettingsFromPreset("professional");
assert.equal(DEFAULT_STYLE_SETTINGS.templateId, "professional");
assert.equal(DEFAULT_STYLE_SETTINGS.pagePadding, professional.pagePadding);
assert.equal(typeof DEFAULT_STYLE_SETTINGS.fontSize.body, "number");

// Missing / corrupt input degrades to the preset instead of producing NaN geometry.
assert.deepEqual(normalizeStyleSettings(undefined), DEFAULT_STYLE_SETTINGS);
assert.deepEqual(normalizeStyleSettings({}), DEFAULT_STYLE_SETTINGS);
assert.equal(normalizeStyleSettings({ lineHeight: "junk" }).lineHeight, professional.lineHeight);
assert.equal(normalizeStyleSettings({ fontSize: { body: NaN } }).fontSize.body, professional.fontSize.body);
assert.equal(normalizeStyleSettings({ templateId: "does-not-exist" }).templateId, "professional");
assert.equal(normalizeStyleSettings({ ruleStyle: "sparkly" }).ruleStyle, professional.ruleStyle);

// Out-of-range values are clamped, not rejected outright.
assert.equal(normalizeStyleSettings({ pagePadding: -50 }).pagePadding, 0);
assert.equal(normalizeStyleSettings({ pagePadding: 9999 }).pagePadding, 96);
assert.equal(normalizeStyleSettings({ lineHeight: 99 }).lineHeight, 2.4);

// Valid values round-trip untouched.
const custom = normalizeStyleSettings({
  templateId: "editorial",
  fontId: "sans",
  colorId: "gray",
  lineHeight: 1.5,
  sectionGap: 12,
  pagePadding: 40,
  fontSize: { heading: 24, body: 11, muted: 10 },
  ruleStyle: "bold"
});
assert.equal(custom.pagePadding, 40);
assert.equal(custom.fontId, "sans");
assert.equal(custom.ruleStyle, "bold");
assert.equal(custom.fontSize.heading, 24);

// Template switch: values still at the old preset move to the new one...
const editorial = styleSettingsFromPreset("editorial");
const untouched = applyTemplatePreset(styleSettingsFromPreset("professional"), "editorial");
assert.equal(untouched.templateId, "editorial");
assert.equal(untouched.fontSize.heading, editorial.fontSize.heading);
assert.equal(untouched.lineHeight, editorial.lineHeight);

// ...but a value the user deliberately changed survives the switch.
const overridden = applyTemplatePreset(
  { ...styleSettingsFromPreset("professional"), pagePadding: 48, lineHeight: 1.9 },
  "editorial"
);
assert.equal(overridden.templateId, "editorial");
assert.equal(overridden.pagePadding, 48, "user page padding must survive a template switch");
assert.equal(overridden.lineHeight, 1.9, "user line height must survive a template switch");
assert.equal(overridden.fontSize.body, editorial.fontSize.body, "untouched sizes still follow the preset");

// Per-size granularity: one overridden size does not pin the others.
const oneSize = applyTemplatePreset(
  { ...styleSettingsFromPreset("professional"), fontSize: { ...professional.fontSize, body: 13 } },
  "editorial"
);
assert.equal(oneSize.fontSize.body, 13);
assert.equal(oneSize.fontSize.heading, editorial.fontSize.heading);

// Equality drives the autosave guard, so it must ignore object identity.
assert.ok(styleSettingsEqual(custom, { ...custom, fontSize: { ...custom.fontSize } }));
assert.ok(!styleSettingsEqual(custom, { ...custom, pagePadding: custom.pagePadding + 1 }));
assert.ok(styleSettingsEqual(undefined, {}), "both empty inputs normalize to the same defaults");

console.log("All style settings checks passed.");
