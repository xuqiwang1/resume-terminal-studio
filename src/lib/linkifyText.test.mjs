import assert from "node:assert/strict";
import { linkifyText, safeLinkHref } from "./linkifyText.js";

function tokens(input) {
  return linkifyText(input);
}

assert.deepEqual(tokens("Project: https://github.com/user/repo"), [
  { type: "text", text: "Project: " },
  { type: "link", text: "https://github.com/user/repo", href: "https://github.com/user/repo" }
]);

assert.deepEqual(tokens("介绍页：https://example.com/demo。"), [
  { type: "text", text: "介绍页：" },
  { type: "link", text: "https://example.com/demo", href: "https://example.com/demo" },
  { type: "text", text: "。" }
]);

assert.deepEqual(tokens("GitHub (https://github.com/user/repo)."), [
  { type: "text", text: "GitHub (" },
  { type: "link", text: "https://github.com/user/repo", href: "https://github.com/user/repo" },
  { type: "text", text: ")." }
]);

assert.deepEqual(tokens("Email: mailto:me@example.com"), [
  { type: "text", text: "Email: " },
  { type: "link", text: "mailto:me@example.com", href: "mailto:me@example.com" }
]);

assert.deepEqual(tokens("Site: www.example.com/case"), [
  { type: "text", text: "Site: " },
  { type: "link", text: "www.example.com/case", href: "https://www.example.com/case" }
]);

assert.deepEqual(tokens("Unsafe javascript:alert(1) stays text"), [
  { type: "text", text: "Unsafe javascript:alert(1) stays text" }
]);

assert.equal(safeLinkHref("https://github.com/user/repo"), "https://github.com/user/repo");
assert.equal(safeLinkHref("http://example.com"), "http://example.com/");
assert.equal(safeLinkHref("mailto:me@example.com"), "mailto:me@example.com");
assert.equal(safeLinkHref("www.example.com"), "https://www.example.com/");
assert.equal(safeLinkHref("javascript:alert(1)"), null);
assert.equal(safeLinkHref("file:///etc/passwd"), null);
