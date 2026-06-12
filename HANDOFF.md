# Resume Studio Handoff

Updated: 2026-06-11

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
- Runtime files `workspace/context-state.json` and `workspace/AGENTS.md` are ignored.
- Agent verification guidance was added to `AGENTS.md`.

## Still Open

- Full autosave for document style settings: `templateId`, font/color, density, page padding, font sizes, and rule style.
- Automatic history checkpoint before accepting an AI patch.
- Manual-vs-AI conflict detection when a pending patch's `before` value no longer matches the current resume.
- Section-level overflow diagnosis for A4 overflow.
- Automated visual screenshot check for Editorial/Apple template.

## Verification Baseline

- Run `npm test` for source-level verification.
- Run `npm run build` after React/CSS/template/export changes.
- Run `npm run install:desktop` only when the installed macOS app needs to be refreshed for the user.

