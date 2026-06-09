// Verifies frontend bridge URL resolution for browser and Electron contexts.
// Run: node src/lib/fileClient.test.mjs

let failures = 0;
function check(name, cond) {
  if (cond) console.log(`  ok  - ${name}`);
  else {
    console.error(`  FAIL - ${name}`);
    failures += 1;
  }
}

const previousWindow = globalThis.window;
const sourceModuleUrl = new URL("./fileClient.js", import.meta.url);
const source = await (await import("node:fs/promises")).readFile(sourceModuleUrl, "utf8");
const { apiUrl, authHeaders, eventSourceUrl, contextApiUrlForTest } = await import("./fileClient.js");

globalThis.window = {};
check("browser mode keeps relative api URL", apiUrl("/api/health") === "/api/health");
check("browser mode sends no auth header", Object.keys(authHeaders()).length === 0);
check("browser event source keeps relative URL", eventSourceUrl("/api/resume/stream") === "/api/resume/stream");

globalThis.window = {
  desktopApp: {
    isDesktop: true,
    bridgeBaseUrl: "http://127.0.0.1:49152",
    bridgeToken: "secret token"
  }
};

check(
  "desktop mode uses bridge absolute api URL",
  apiUrl("/api/health") === "http://127.0.0.1:49152/api/health"
);
check("desktop mode sends auth header", authHeaders()["x-resume-studio-token"] === "secret token");
check(
  "desktop event source carries token query",
  eventSourceUrl("/api/resume/stream") ===
    "http://127.0.0.1:49152/api/resume/stream?token=secret+token"
);
check(
  "desktop context API uses bridge base URL",
  contextApiUrlForTest("/api/context") === "http://127.0.0.1:49152/api/context"
);
check("fileClient exports fetchPendingPatch", source.includes("export async function fetchPendingPatch"));
check("fetchPendingPatch calls pending endpoint", source.includes('apiUrl("/api/patch/pending")'));
check("confirmPendingPatch surfaces server errors", source.includes('payload.error || "Failed to confirm patch"'));
check("rejectPendingPatch surfaces server errors", source.includes('payload.error || "Failed to reject patch"'));

globalThis.window = previousWindow;

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll fileClient checks passed.");
