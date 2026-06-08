import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const siteDir = join(scriptDir, "..");
const rootDir = join(siteDir, "..");
const outDir = join(rootDir, "site-dist");

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });
await cp(join(siteDir, "index.html"), join(outDir, "index.html"));
await cp(join(siteDir, "styles.css"), join(outDir, "styles.css"));

console.log(`Built static site to ${outDir}`);
