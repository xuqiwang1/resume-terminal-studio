import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, "DraggableAvatar.jsx"), "utf8");

assert.match(source, /className\s*=/);
assert.match(source, /className=\{`draggable-avatar \$\{className\}`\.trim\(\)\}/);
