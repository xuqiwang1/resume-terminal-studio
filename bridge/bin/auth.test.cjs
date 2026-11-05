// Verifies bridge request authorization:
//  - a configured token rejects missing or wrong credentials
//  - the token may be supplied as a header anywhere, but as a query parameter
//    ONLY on the SSE endpoints that cannot set headers
//  - foreign origins are rejected outright (DNS rebinding / drive-by POSTs)
// The bridge always configures a token now (startBridgeServer generates one when
// the environment supplies none), so there is no unauthenticated mode to test.
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
  const { isAuthorizedRequest, isAllowedOrigin, getBridgeToken } = await import("../server.js");

  check(
    "matching header token is accepted",
    isAuthorizedRequest({ headers: { "x-resume-studio-token": "secret" }, url: "/api/health" }, "secret")
  );
  check(
    "missing token is rejected when configured",
    !isAuthorizedRequest({ headers: {}, url: "/api/health" }, "secret")
  );
  check(
    "wrong token is rejected",
    !isAuthorizedRequest({ headers: { "x-resume-studio-token": "wrong" }, url: "/api/health" }, "secret")
  );
  check(
    "a token of a different length is rejected",
    !isAuthorizedRequest({ headers: { "x-resume-studio-token": "secretsecret" }, url: "/api/health" }, "secret")
  );

  // EventSource cannot set headers, so these three endpoints accept ?token=.
  for (const streamPath of ["/api/resume/stream", "/api/activity/stream", "/api/patch/stream"]) {
    check(
      `query token is accepted on ${streamPath}`,
      isAuthorizedRequest({ headers: {}, url: `${streamPath}?token=secret` }, "secret")
    );
  }

  // Everything that can mutate the resume must use the header, keeping the
  // credential out of referrers, proxy logs, and shell history.
  check(
    "query token is rejected on a mutating endpoint",
    !isAuthorizedRequest({ headers: {}, url: "/api/patch/confirm?token=secret" }, "secret")
  );
  check(
    "query token is rejected on a plain GET endpoint",
    !isAuthorizedRequest({ headers: {}, url: "/api/health?token=secret" }, "secret")
  );
  check(
    "wrong query token is rejected on a stream endpoint",
    !isAuthorizedRequest({ headers: {}, url: "/api/resume/stream?token=nope" }, "secret")
  );

  // Origin checks: a page on any site can POST to 127.0.0.1, and DNS rebinding
  // can point a remote hostname here.
  check("a request with no origin is allowed (CLI, Electron)", isAllowedOrigin({ headers: {} }));
  check("a file:// origin is allowed (packaged renderer)", isAllowedOrigin({ headers: { origin: "file://" } }));
  check(
    "a localhost origin is allowed (vite dev server)",
    isAllowedOrigin({ headers: { origin: "http://localhost:4173" } })
  );
  check(
    "a 127.0.0.1 origin is allowed",
    isAllowedOrigin({ headers: { origin: "http://127.0.0.1:4173" } })
  );
  check(
    "a remote origin is rejected",
    !isAllowedOrigin({ headers: { origin: "https://evil.example.com" } })
  );
  check(
    "a rebinding-style origin is rejected",
    !isAllowedOrigin({ headers: { origin: "http://127.0.0.1.evil.example.com" } })
  );

  check("the bridge token accessor is exported", typeof getBridgeToken === "function");

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll auth checks passed.");
})();
