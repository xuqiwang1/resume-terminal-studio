// Verifies bridge request authorization:
//  - no token configured means local dev remains open
//  - configured token rejects missing or wrong credentials
//  - token can be supplied via header or query string for EventSource
// Run: node bridge/bin/auth.test.cjs

let failures = 0;
function check(name, cond) {
  if (cond) console.log(`  ok  - ${name}`);
  else {
    console.error(`  FAIL - ${name}`);
    failures += 1;
  }
}

(async () => {
  const { isAuthorizedRequest } = await import("../server.js");

  check("dev mode without configured token allows requests", isAuthorizedRequest({}, ""));
  check(
    "matching header token is accepted",
    isAuthorizedRequest({ headers: { "x-resume-studio-token": "secret" }, url: "/api/health" }, "secret")
  );
  check(
    "matching query token is accepted",
    isAuthorizedRequest({ headers: {}, url: "/api/resume/stream?token=secret" }, "secret")
  );
  check(
    "missing token is rejected when configured",
    !isAuthorizedRequest({ headers: {}, url: "/api/health" }, "secret")
  );
  check(
    "wrong token is rejected",
    !isAuthorizedRequest({ headers: { "x-resume-studio-token": "wrong" }, url: "/api/health" }, "secret")
  );

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll auth checks passed.");
})();
