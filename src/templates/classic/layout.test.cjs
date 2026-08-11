// Verifies the Classic template keeps the shared editing behavior while
// applying the single-column visual treatment shown in its dedicated styles.
const fs = require("node:fs");
const path = require("node:path");

const registry = fs.readFileSync(path.join(__dirname, "..", "registry.js"), "utf8");
const classic = fs.readFileSync(path.join(__dirname, "index.jsx"), "utf8");
const professional = fs.readFileSync(path.join(__dirname, "..", "professional", "index.jsx"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "..", "..", "index.css"), "utf8");

let failures = 0;
function check(name, condition) {
  if (condition) console.log(`  ok  - ${name}`);
  else {
    console.error(`  FAIL - ${name}`);
    failures += 1;
  }
}

check("classic template is registered", registry.includes('id: "classic"'));
check("classic template keeps shared professional renderer", classic.includes('templateVariant: "classic"'));
check("classic variant moves summary before education", professional.includes("{isClassic && summarySection}") && professional.includes("const isClassic = templateVariant === \"classic\";"));
check("classic header is left aligned", css.includes(".template-classic .pro-header") && css.includes("text-align: left;"));
check("classic header does not add a full-width divider", css.includes(".template-classic .pro-header") && css.includes("border-bottom: none;"));
check("classic avatar uses shared draggable positioning", professional.includes("position={avatarPos}") && professional.includes("onPositionChange={onAvatarPosChange}") && !professional.includes("draggable={!isClassic}"));
check("classic avatar uses a compact square size", professional.includes("size={isClassic ? 64 : 72}") && css.includes("width: 64px;") && css.includes("height: 64px;"));
check("classic avatar has rounded corners", css.includes("border-radius: 12px;"));
check("classic avatar keeps the drag handle visible", !css.includes(".template-classic .pro-header .pro-avatar-topright .drag-handle"));
check("classic section headings place a full-width rule below the title", css.includes(".template-classic .pro-section-head") && css.includes("display: block;") && css.includes(".template-classic .pro-rule") && css.includes("width: 100%;"));
check("classic body uses compact left-aligned text", css.includes(".template-classic .pro-body") && css.includes("text-align: left;"));

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll Classic layout checks passed.");
