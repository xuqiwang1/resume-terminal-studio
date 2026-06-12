import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, "RichText.jsx"), "utf8");
const css = fs.readFileSync(path.join(here, "../index.css"), "utf8");

assert.match(source, /import\s+\{\s*linkifyText\s*\}\s+from\s+["']\.\.\/lib\/linkifyText["'];?/);
assert.match(source, /function RichText\(\{ value, fieldId, linkStyle \}\)/);
assert.match(source, /<a\s+/);
assert.match(source, /target="_blank"/);
assert.match(source, /rel="noreferrer"/);
assert.match(source, /style=\{\{ \.\.\.style, \.\.\.linkStyle \}\}/);
assert.match(source, /data-rich-link/);
assert.match(source, /METRIC_RE/);
assert.match(source, /splitMetricText/);
assert.match(source, /data-rich-metric/);
assert.match(source, /fontWeight:\s*700/);
assert.match(css, /a\[data-rich-link\]/);
assert.match(css, /color:\s*var\(--r-link-color/);
assert.match(css, /text-decoration:\s*var\(--r-link-decoration/);
