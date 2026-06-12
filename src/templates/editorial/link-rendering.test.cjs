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

check("editorial imports RichText", source.includes('import RichText from "../../components/RichText";'));
check("editorial contact renders through RichText", source.includes('<RichText value={resume.contact} fieldId={fieldId("header", null, "contact")} />'));
check("editorial skills render through RichText", source.includes('<RichText value={item.content} fieldId={fieldId("skills", index, "content")} />'));
check("editorial structured text renders through RichText", source.includes("<RichText value={trimmed} fieldId={`editorial-structured.${index}`} />"));
check("editorial labeled structured text renders through RichText", source.includes("<RichText value={labeled[2]} fieldId={`editorial-structured.${index}`} />"));
check("editorial summary renders through RichText", source.includes('<RichText value={summaryDraft ?? resume.summary} fieldId={fieldId("summary", null, "text")} />'));

if (failed) process.exit(1);
