import assert from "node:assert/strict";
import { diagnoseSectionOverflow, formatSectionOverflow } from "./sectionOverflow.js";

// Pure geometry: a section is reported only when its bottom passes the last
// printable pixel, and the amount is how far past it goes.
const contentBottom = 1099; // 1123 page height - 24 padding

assert.deepEqual(diagnoseSectionOverflow([], contentBottom), []);
assert.deepEqual(diagnoseSectionOverflow(null, contentBottom), []);
assert.deepEqual(diagnoseSectionOverflow([{ sectionId: "summary", top: 0, bottom: 400 }], NaN), []);

// Sections fully inside the page are never reported.
assert.deepEqual(
  diagnoseSectionOverflow(
    [
      { sectionId: "header", top: 0, bottom: 120 },
      { sectionId: "summary", top: 120, bottom: 300 }
    ],
    contentBottom
  ),
  []
);

// A section straddling the fold is reported with the overshoot, not its full height.
const straddling = diagnoseSectionOverflow(
  [{ sectionId: "projects", top: 1000, bottom: 1160 }],
  contentBottom
);
assert.equal(straddling.length, 1);
assert.equal(straddling[0].sectionId, "projects");
assert.equal(straddling[0].overflowPx, 61);
assert.equal(straddling[0].fullyBelow, false);
assert.equal(straddling[0].label, "项目经历", "labels come from the shared section map");

// A section that starts below the fold is flagged separately: it is entirely off-page.
const below = diagnoseSectionOverflow([{ sectionId: "skills", top: 1120, bottom: 1240 }], contentBottom);
assert.equal(below[0].fullyBelow, true);
assert.equal(below[0].overflowPx, 141);

// Worst offender first, so the message names the section most worth shortening.
const ranked = diagnoseSectionOverflow(
  [
    { sectionId: "summary", top: 1090, bottom: 1110 },
    { sectionId: "skills", top: 1100, bottom: 1300 },
    { sectionId: "education", top: 200, bottom: 400 }
  ],
  contentBottom
);
assert.deepEqual(ranked.map((s) => s.sectionId), ["skills", "summary"]);

// Exactly at the boundary is not overflow.
assert.deepEqual(diagnoseSectionOverflow([{ sectionId: "summary", top: 0, bottom: contentBottom }], contentBottom), []);

// Malformed entries are skipped rather than throwing.
assert.deepEqual(diagnoseSectionOverflow([{ sectionId: "x" }, null, { bottom: "tall" }], contentBottom), []);

// An unknown section id still produces a usable label.
assert.equal(diagnoseSectionOverflow([{ sectionId: "custom", top: 0, bottom: 1200 }], contentBottom)[0].label, "custom");

// Message formatting.
assert.equal(formatSectionOverflow([]), "");
assert.equal(formatSectionOverflow(ranked), "专业技能 +201px、个人总结 +11px");
const many = diagnoseSectionOverflow(
  [
    { sectionId: "skills", top: 1100, bottom: 1400 },
    { sectionId: "projects", top: 1100, bottom: 1300 },
    { sectionId: "experience", top: 1100, bottom: 1200 },
    { sectionId: "summary", top: 1100, bottom: 1150 }
  ],
  contentBottom
);
assert.ok(formatSectionOverflow(many).endsWith("等 4 处"), "long lists are truncated with a count");

console.log("All section overflow checks passed.");
