# Resume Studio Agent Rules

This repository builds **Resume Studio**, a local-first desktop resume workbench.

## Resume Editing Contract

- Do not edit `active-resume.json` directly.
- Do not edit files under `workspace/`, `~/Documents/ResumeStudio/`, `history/`, or `materials/` unless the user explicitly asks for workspace maintenance.
- Do not run `resume-agent confirm` or `resume-agent reject`.
- Do not quit, kill, reopen, rebuild, unpack, or patch the installed app unless the user explicitly asks for app development work.
- For resume content changes, use the MCP flow: `get_context` -> `get_materials` -> `propose_edit` or `propose_batch_edit`. From a terminal, the equivalent is `node bridge/bin/resume-cli.cjs edit ...`, which stages the same pending patch through `POST /api/patch/propose`.
- Before proposing edits, verify `get_context.workspaceDiagnostics.aligned` is true. A mismatch means the agent and app are not using the same workspace.
- Use `propose_edit` for one narrow field/bullet edit. Use `propose_batch_edit` for one coherent multi-field or multi-item task.
- `propose_edit` supports top-level `name`, `title`, `contact`, and `summary` edits without `index`/`field`.
- `propose_edit` and `propose_batch_edit` only stage pending patches. Pending patches are bound to the current app `documentId` and `revision`; the user accepts or rejects them in the Resume Studio app.

## Development Work

- Keep the desktop app, landing site, and README separate.
- Preserve local-first privacy boundaries; never commit real resume files, source materials, history, `dist/`, `release/`, or local workspace data.
- For layout/style fixes, change the source code and run tests/builds. Do not patch the packaged app bundle directly.
- Read `HANDOFF.md` before resuming long-running app work; update it when completing or deferring roadmap items.

## Verification

- Run `npm test` before claiming source changes are complete.
- Run `npm run build` after React, CSS, template, or export-flow changes.
- Run `npm run install:desktop` only when the user needs the installed macOS app refreshed.
- After installing the desktop app, open `/Applications/Resume Studio.app` so the user sees the new build.
