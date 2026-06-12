import fs from "node:fs";

let failures = 0;
function check(name, cond) {
  if (cond) console.log(`  ok  - ${name}`);
  else {
    console.error(`  FAIL - ${name}`);
    failures += 1;
  }
}

const appSource = fs.readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
const previewSource = fs.readFileSync(new URL("./components/ResumePreview.jsx", import.meta.url), "utf8");
const hookSource = fs.readFileSync(new URL("./hooks/useResumeStudio.js", import.meta.url), "utf8");
const constantsSource = fs.readFileSync(new URL("./lib/a4Page.js", import.meta.url), "utf8");

check("A4 page constants define fixed preview/export height", constantsSource.includes("A4_PAGE_HEIGHT_PX = 1123"));
check("A4 page constants define fixed preview width", constantsSource.includes("A4_PAGE_WIDTH_PX = 794"));
check("App export uses shared A4 height", appSource.includes("A4_PAGE_HEIGHT_PX"));
check("App export blocks overflow before exporting", appSource.includes("ExportPreflightError"));
check("App export no longer auto-compresses content", !appSource.includes("fitSinglePage"));
check("preview uses shared A4 constants", previewSource.includes("A4_PAGE_HEIGHT_PX") && previewSource.includes("A4_PAGE_WIDTH_PX"));
check("hook no longer exposes hidden auto-fit action", !hookSource.includes("fitSinglePage"));

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll export/A4 consistency checks passed.");

