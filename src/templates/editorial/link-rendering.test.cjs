const fs = require("fs");
const path = require("path");

let failed = false;
function check(name, condition) {
  if (!condition) {
    failed = true;
    console.error(`FAIL ${name}`);
  }
}

const templatePath = path.join(__dirname, "index.jsx");
const source = fs.readFileSync(templatePath, "utf8");

function hasRichText(value, fid) {
  return source.includes(`<RichText value={${value}} fieldId={${fid}}`);
}

check("editorial imports RichText", source.includes('import RichText from "../../components/RichText";'));
check("editorial contact renders through RichText", hasRichText("resume.contact", 'fieldId("header", null, "contact")'));
check("editorial title renders through RichText", hasRichText("resume.title", 'fieldId("header", null, "title")'));
check("editorial project name renders through RichText", hasRichText("item.name", 'fieldId("projects", index, "name")'));
check("editorial project role renders through RichText", hasRichText("item.role", 'fieldId("projects", index, "role")'));
check("editorial skill category renders through RichText", hasRichText("item.category", 'fieldId("skills", index, "category")'));
check("editorial skills render through RichText", hasRichText("item.content", 'fieldId("skills", index, "content")'));
check("editorial structured text renders through RichText", source.includes("<RichText value={trimmed} fieldId={`editorial-structured.${index}`} />"));
check("editorial labeled structured text renders through RichText", source.includes("<RichText value={labeled[2]} fieldId={`editorial-structured.${index}`} />"));
check("editorial summary renders through RichText", hasRichText("summaryDraft ?? resume.summary", 'fieldId("summary", null, "text")'));

if (failed) process.exit(1);
