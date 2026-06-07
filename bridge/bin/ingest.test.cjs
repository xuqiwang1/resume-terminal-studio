// Verifies the materials ingest pipeline:
//  - .md/.txt copied through
//  - .xlsx converted to a markdown table
//  - an index.md is produced
//  - a broken/empty "pdf" is skipped without crashing
// Run: node bridge/bin/ingest.test.cjs
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "resume-ingest-"));
process.env.WORKSPACE_DIR = tmp;

const materialsDir = path.join(tmp, "materials");
const extractedDir = path.join(materialsDir, ".extracted");
fs.mkdirSync(materialsDir, { recursive: true });

// seed a markdown file
fs.writeFileSync(path.join(materialsDir, "notes.md"), "# 实习笔记\n负责数据看板。", "utf8");

// seed a regular xlsx via the same library used by ingest
const XLSX = require("xlsx");
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet([
  ["指标", "数值"],
  ["DAU", 12000],
  ["留存", "42%"]
]);
XLSX.utils.book_append_sheet(wb, ws, "数据");
XLSX.writeFile(wb, path.join(materialsDir, "metrics.xlsx"));

// seed a fake/broken pdf (not real PDF bytes) -> should be skipped gracefully
fs.writeFileSync(path.join(materialsDir, "broken.pdf"), "not a real pdf", "utf8");

let failures = 0;
function check(name, cond) {
  if (cond) console.log(`  ok  - ${name}`);
  else {
    console.error(`  FAIL - ${name}`);
    failures += 1;
  }
}

(async () => {
  const { run } = require("./ingest.cjs");
  const result = await run();

  const mdOut = path.join(extractedDir, "notes.md.md");
  const xlsxOut = path.join(extractedDir, "metrics.xlsx.md");
  const indexOut = path.join(extractedDir, "index.md");

  check("markdown source extracted", fs.existsSync(mdOut));
  check("markdown content preserved", fs.readFileSync(mdOut, "utf8").includes("负责数据看板"));

  check("xlsx extracted", fs.existsSync(xlsxOut));
  const xlsxText = fs.existsSync(xlsxOut) ? fs.readFileSync(xlsxOut, "utf8") : "";
  check("xlsx becomes a markdown table", /\| 指标 \| 数值 \|/.test(xlsxText));
  check("xlsx data rows present", xlsxText.includes("DAU") && xlsxText.includes("12000"));

  check("index.md generated", fs.existsSync(indexOut));
  check("broken pdf is skipped (not crashed)", result.skipped >= 1);
  check("at least md + xlsx extracted ok", result.ok >= 2);

  fs.rmSync(tmp, { recursive: true, force: true });

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll ingest checks passed.");
})();
