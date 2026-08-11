const fs = require("fs");
const path = require("path");
const { rendersThroughRichText } = require("../richTextContract.cjs");

let failed = false;
function check(name, condition) {
  if (!condition) {
    failed = true;
    console.error(`FAIL ${name}`);
  }
}

const templatePath = path.join(__dirname, "index.jsx");
const source = fs.readFileSync(templatePath, "utf8");

// A field is "wired" when it renders through <RichText> under its stable fieldId,
// regardless of which value expression feeds it or how props are ordered.
function wired(fieldId) {
  return rendersThroughRichText(source, { fieldId });
}

check("editorial imports RichText", source.includes('import RichText from "../../components/RichText";'));
check("editorial contact renders through RichText", wired('fieldId("header", null, "contact")'));
check("editorial title renders through RichText", wired('fieldId("header", null, "title")'));
check("editorial project name renders through RichText", wired('fieldId("projects", index, "name")'));
check("editorial project role renders through RichText", wired('fieldId("projects", index, "role")'));
check("editorial skill category renders through RichText", wired('fieldId("skills", index, "category")'));
check("editorial skills render through RichText", wired('fieldId("skills", index, "content")'));
check("editorial summary renders through RichText", wired('fieldId("summary", null, "text")'));

// The two structured-line paths share one fieldId, so the value expression is what
// distinguishes the labeled path from the unlabeled one — pin it for these two only.
const structuredFieldId = "`editorial-structured.${index}`";
check(
  "editorial structured text renders through RichText",
  rendersThroughRichText(source, { fieldId: structuredFieldId, value: "trimmed" })
);
check(
  "editorial labeled structured text renders through RichText",
  rendersThroughRichText(source, { fieldId: structuredFieldId, value: "labeled[2]" })
);

if (failed) process.exit(1);
