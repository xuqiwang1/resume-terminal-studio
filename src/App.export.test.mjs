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
const printSource = fs.readFileSync(new URL("./components/PrintView.jsx", import.meta.url), "utf8");
const styleSource = fs.readFileSync(new URL("./lib/resumePageStyle.js", import.meta.url), "utf8");
const hookSource = fs.readFileSync(new URL("./hooks/useResumeStudio.js", import.meta.url), "utf8");
const constantsSource = fs.readFileSync(new URL("./lib/a4Page.js", import.meta.url), "utf8");
const cssSource = fs.readFileSync(new URL("./index.css", import.meta.url), "utf8");

check("A4 page constants define fixed preview/export height", constantsSource.includes("A4_PAGE_HEIGHT_PX = 1123"));
check("A4 page constants define fixed preview width", constantsSource.includes("A4_PAGE_WIDTH_PX = 794"));
check("App export uses shared A4 height", appSource.includes("A4_PAGE_HEIGHT_PX"));
check("App export blocks overflow before exporting", appSource.includes("ExportPreflightError"));
check("App export no longer auto-compresses content", !appSource.includes("fitSinglePage"));
check("preview uses shared A4 constants", previewSource.includes("A4_PAGE_HEIGHT_PX") && previewSource.includes("A4_PAGE_WIDTH_PX"));
check("preview defaults to 100% paper scale", previewSource.includes("useState(1)"));
check("preview exposes A4 auto-fit control", previewSource.includes("autoFit") && previewSource.includes("自动适配") && previewSource.includes("onAutoFitChange"));
check("preview measures natural resume content", previewSource.includes('querySelector(".resume-content")'));
check("auto-fit keeps natural content measurable inside one A4 page", previewSource.includes('" auto-fit"') && cssSource.includes(".resume-page.auto-fit .resume-content {\n  min-height: 0;\n}"));
check("auto-fit adjusts density across the whole page", previewSource.includes("fitScale") && styleSource.includes("--r-card-heading") && cssSource.includes("var(--r-fs-body"));
check("auto-fit settles offscreen before updating the visible page", previewSource.includes("resume-fit-measure") && previewSource.includes("fitBestRef.current?.style") && cssSource.includes(".resume-page.auto-fitting"));
check("shared page style applies link vars", styleSource.includes("buildLinkStyleVars(layoutConfig?.linkStyle)"));
check("PrintView receives adaptive layout values", printSource.includes("adaptiveStyle") && printSource.includes("effectiveStyle"));
check("App shares adaptive layout with print view", appSource.includes("onAdaptiveStyleChange={setAdaptiveStyle}") && appSource.includes("adaptiveStyle={autoFit ? adaptiveStyle : null}"));
check("hook no longer exposes hidden auto-fit action", !hookSource.includes("fitSinglePage"));
check("preview attributes overflow to sections", previewSource.includes("measureSectionOverflow") && previewSource.includes("onOverflowChange"));
check("overflow badge names the offending sections", previewSource.includes("formatSectionOverflow(overflowSections)"));
check("export preflight names the offending sections", appSource.includes("formatSectionOverflow(overflowReport.sections"));
check("debug hook reports section overflow", appSource.includes("overflowSections: overflowReport.sections"));
check("every section carries a stable id for measurement", (() => {
  const professional = fs.readFileSync(new URL("./templates/professional/index.jsx", import.meta.url), "utf8");
  return professional.includes('data-section="header"');
})());

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll export/A4 consistency checks passed.");
