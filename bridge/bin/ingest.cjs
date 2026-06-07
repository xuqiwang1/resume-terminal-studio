#!/usr/bin/env node
// Materials ingest: scan workspace/materials/, extract each file into clean
// markdown the agent can read, and write the result to materials/.extracted/.
//
// Scope (by design): text-based PDF + tabular .xlsx + plain text/markdown.
// Out of scope: OCR / scanned PDFs, complex merged-cell sheets, doc/ppt.
//
// Usage: node bridge/bin/ingest.cjs   (or: resume-agent ingest)

const fs = require("node:fs");
const path = require("node:path");
const { materialsDir, extractedDir } = require("./resume-engine.cjs");

const SUPPORTED = new Set([".md", ".txt", ".pdf", ".xlsx"]);

function ensureDirs() {
  fs.mkdirSync(materialsDir, { recursive: true });
  fs.mkdirSync(extractedDir, { recursive: true });
}

function listSourceFiles() {
  return fs
    .readdirSync(materialsDir)
    .filter((name) => !name.startsWith("."))
    .filter((name) => fs.statSync(path.join(materialsDir, name)).isFile())
    .filter((name) => SUPPORTED.has(path.extname(name).toLowerCase()));
}

function extractText(fullPath) {
  // .txt / .md → as-is
  return fs.readFileSync(fullPath, "utf8");
}

async function extractPdf(fullPath) {
  const pdfParse = require("pdf-parse");
  const buffer = fs.readFileSync(fullPath);
  const data = await pdfParse(buffer);
  const text = (data.text || "").trim();
  if (!text) {
    // No extractable text layer → almost certainly a scanned/image PDF.
    throw new Error("no extractable text (likely a scanned/image PDF; OCR not supported)");
  }
  return text;
}

function extractXlsx(fullPath) {
  const XLSX = require("xlsx");
  const wb = XLSX.readFile(fullPath);
  const parts = [];
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
    if (!rows.length) continue;
    parts.push(`### Sheet: ${sheetName}\n`);
    parts.push(rowsToMarkdownTable(rows));
    parts.push("");
  }
  return parts.join("\n").trim();
}

function rowsToMarkdownTable(rows) {
  const width = rows.reduce((max, r) => Math.max(max, r.length), 0);
  const cell = (v) => String(v == null ? "" : v).replace(/\|/g, "\\|").replace(/\n/g, " ");
  const pad = (r) => {
    const out = [];
    for (let i = 0; i < width; i += 1) out.push(cell(r[i]));
    return out;
  };
  const header = pad(rows[0]);
  const sep = new Array(width).fill("---");
  const body = rows.slice(1).map((r) => `| ${pad(r).join(" | ")} |`);
  return [`| ${header.join(" | ")} |`, `| ${sep.join(" | ")} |`, ...body].join("\n");
}

async function run() {
  ensureDirs();
  const files = listSourceFiles();
  const results = [];

  for (const name of files) {
    const fullPath = path.join(materialsDir, name);
    const ext = path.extname(name).toLowerCase();
    const outName = `${name}.md`;
    const outPath = path.join(extractedDir, outName);
    try {
      let text;
      if (ext === ".pdf") text = await extractPdf(fullPath);
      else if (ext === ".xlsx") text = extractXlsx(fullPath);
      else text = extractText(fullPath);

      const body = `# ${name}\n\n_source: materials/${name}_\n\n${text}\n`;
      fs.writeFileSync(outPath, body, "utf8");
      results.push({ name, outName, ok: true });
      console.log(`  ok   - ${name} -> .extracted/${outName}`);
    } catch (error) {
      results.push({ name, ok: false, error: error.message });
      console.warn(`  skip - ${name}: ${error.message}`);
    }
  }

  // Write an index so the agent can discover what is available in one read.
  const ok = results.filter((r) => r.ok);
  const skipped = results.filter((r) => !r.ok);
  const indexLines = [
    "# Extracted materials index",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    `Read these files to understand the user's real experience. ${ok.length} available.`,
    "",
    ...ok.map((r) => `- [${r.name}](./${r.outName})`)
  ];
  if (skipped.length) {
    indexLines.push("", "## Skipped", "");
    indexLines.push(...skipped.map((r) => `- ${r.name} — ${r.error}`));
  }
  fs.writeFileSync(path.join(extractedDir, "index.md"), `${indexLines.join("\n")}\n`, "utf8");

  console.log(`\nIngest done: ${ok.length} extracted, ${skipped.length} skipped.`);
  console.log(`Output: ${extractedDir}`);
  return { ok: ok.length, skipped: skipped.length };
}

if (require.main === module) {
  run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { run };
