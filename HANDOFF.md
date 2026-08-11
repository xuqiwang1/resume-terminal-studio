# Resume Studio Handoff

Updated: 2026-08-11

## Current State

- The app is in active development for Resume Studio, a local-first Electron resume editor.
- Resume content must not be edited directly in runtime files. Use the MCP pending-patch flow for resume text changes.
- Source changes currently include AI patch safety, A4/export consistency, state preservation, left panel density, and template parity work.

## Completed In Current Round

- Pending patches support source evidence metadata and render it in the review UI.
- Batch patch risk levels are classified as low/medium/high.
- High-risk batch edits require `allowHighRisk: true` and an explicit UI acknowledgement before accept.
- A4 preview/export now share fixed A4 constants; export blocks on overflow instead of auto-compressing.
- Hidden `fitSinglePage` auto-compression path was removed.
- Avatar, avatar position, field styles, and layout config are preserved through patch confirmation.
- Left style panel no longer shows the redundant current-selection summary.
- Professional education row date/school/tag/major now use body-level styling.
- Editorial/Apple template now supports avatar, field styles, structured details, and current resume fields.
- Added the Classic single-column template with under-heading rules and per-template compact A4 style presets.
- Reduced the Classic template avatar to 64px and enabled drag-to-position behavior.
- Added a bounded A4 auto-fit toggle that recalculates content density and shares the effective style with PDF export.
- Auto-fit now solves on an offscreen A4 copy with bounded binary search, then commits the densest safe single-page style once to avoid visible jitter.
- Professional body text now shares the exact horizontal content edge of each section rule and entry header.
- Runtime files `workspace/context-state.json` and `workspace/AGENTS.md` are ignored.
- Agent verification guidance was added to `AGENTS.md`.
- Document style settings (`templateId`, font, color, density, page padding, font sizes, rule style) now live inside the resume under `styleSettings` and autosave 400ms after the last change, on their own presentation-only endpoint (`POST /api/resume/style`) that cannot touch content.
- Switching templates keeps values the user deliberately changed; only values still sitting at the outgoing template's preset move to the new one.
- Accepting an AI patch now archives the pre-patch resume first (reason `before-ai-patch`, capped at 40 auto checkpoints; manual snapshots are never pruned).
- Manual-vs-AI conflict detection: if a pending patch's recorded `before` no longer matches the document, the review UI shows the recorded and current text side by side and accept is blocked until the user explicitly chooses to overwrite. The server re-checks at confirm time and answers 409.
- A4 overflow is now attributed to specific sections in the preview badge and in the export preflight error, ranked worst-first.
- Every section, including the header, carries `data-section` so overflow can be measured without template-specific knowledge.
- Added `npm run verify:visual`: renders Editorial in Electron against a fixture workspace and asserts page size, single-page fit, section order, non-empty sections, and that no overflow warning is showing; writes a PNG for human review.

## Still Open

- Nothing from the previous round. Next candidates, in rough order of value:
  - Undo for a confirmed patch that reads the auto checkpoint back without a full history restore.
  - Extend the visual check to the Professional and Classic templates (the harness is template-agnostic; only the fixture and expected section order differ).
  - Conflict detection currently compares exact strings; a whitespace-insensitive compare would cut false positives from inline restyling.

## Verification Baseline

- Run `npm test` for source-level verification.
- Run `npm run build` after React/CSS/template/export changes.
- Run `npm run verify:visual` after touching the Editorial template, A4 geometry, or auto-fit. Needs `npm run build` first and a real display, so it is deliberately outside `npm test`.
- Run `npm run install:desktop` only when the installed macOS app needs to be refreshed for the user.
