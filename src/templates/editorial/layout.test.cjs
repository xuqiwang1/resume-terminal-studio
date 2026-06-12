const fs = require("fs");
const path = require("path");

let failed = false;
function check(name, condition) {
  if (!condition) {
    failed = true;
    console.error(`FAIL ${name}`);
  }
}

const source = fs.readFileSync(path.join(__dirname, "index.jsx"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "..", "..", "index.css"), "utf8");

check("editorial imports draggable avatar", source.includes('import DraggableAvatar from "../../components/DraggableAvatar";'));
check("editorial renders avatar from shared ctx", source.includes("avatar &&") && source.includes("editorial-avatar-topright"));
check("editorial passes avatar position handler", source.includes("onPositionChange={onAvatarPosChange}"));
check("editorial reads layout config", source.includes("layoutConfig"));
check("editorial supports inline skills layout", source.includes('skillsLayout === "inline"'));
check("editorial exposes education tag as selectable field", source.includes('fieldId("education", index, "tag")'));
check("editorial exposes education degree as selectable field", source.includes('fieldId("education", index, "degree")'));
check("editorial applies shared font size variables", source.includes("var(--r-fs-heading") && source.includes("var(--r-fs-body"));
check("css positions editorial avatar", css.includes(".template-editorial .editorial-avatar-topright"));
check("css defines editorial structured body", css.includes(".template-editorial .editorial-structured-body"));
check("css defines editorial inline skills", css.includes(".template-editorial .editorial-skill-card.skill-inline"));

if (failed) process.exit(1);
console.log("All Editorial layout checks passed.");

