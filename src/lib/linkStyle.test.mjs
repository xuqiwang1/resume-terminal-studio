import assert from "node:assert/strict";
import { buildLinkStyleVars, normalizeLinkStyle } from "./linkStyle.js";

assert.deepEqual(normalizeLinkStyle(undefined), {
  mode: "default",
  color: "#0645ad",
  underline: true
});

assert.deepEqual(buildLinkStyleVars({ mode: "default" }), {
  "--r-link-color": "#0645ad",
  "--r-link-decoration": "underline"
});

assert.deepEqual(buildLinkStyleVars({ mode: "inherit", underline: true }), {
  "--r-link-color": "inherit",
  "--r-link-decoration": "underline"
});

assert.deepEqual(buildLinkStyleVars({ mode: "custom", color: "#111111", underline: false }), {
  "--r-link-color": "#111111",
  "--r-link-decoration": "none"
});
