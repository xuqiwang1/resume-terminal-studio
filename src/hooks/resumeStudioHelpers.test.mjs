import assert from "node:assert/strict";
import {
  getPendingPatchPrimarySection,
  normalizePendingSection,
  patchFieldId,
  sectionIdFromFieldId
} from "./resumeStudioHelpers.js";

assert.equal(sectionIdFromFieldId("header.name"), "header");
assert.equal(sectionIdFromFieldId("summary.text"), "summary");

assert.equal(normalizePendingSection("name"), "header");
assert.equal(normalizePendingSection("title"), "header");
assert.equal(normalizePendingSection("contact"), "header");
assert.equal(normalizePendingSection("skills"), "skills");

assert.equal(patchFieldId("name"), "header.name");
assert.equal(patchFieldId("title"), "header.title");
assert.equal(patchFieldId("contact"), "header.contact");

assert.equal(
  getPendingPatchPrimarySection({
    kind: "single",
    sectionId: "title"
  }),
  "header"
);

assert.equal(
  getPendingPatchPrimarySection({
    kind: "batch",
    changes: [{ operation: "replace_section", sectionId: "contact", after: "x" }]
  }),
  "header"
);

console.log("All resumeStudioHelpers checks passed.");
