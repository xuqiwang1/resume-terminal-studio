# Resume Studio Agent Rules

This repository builds **Resume Studio**, a local-first desktop resume workbench.

## Resume Editing Contract

- Do not edit `active-resume.json` directly.
- Do not edit files under `workspace/`, `~/Documents/ResumeStudio/`, `history/`, or `materials/` unless the user explicitly asks for workspace maintenance.
- Do not run `resume-agent confirm` or `resume-agent reject`.
- Do not quit, kill, reopen, rebuild, unpack, or patch the installed app unless the user explicitly asks for app development work.
- For resume content changes, use the MCP flow: `get_context` -> `get_materials` -> `propose_edit`.
- `propose_edit` only stages a pending patch. The user accepts or rejects it in the Resume Studio app.

## Development Work

- Keep the desktop app, landing site, and README separate.
- Preserve local-first privacy boundaries; never commit real resume files, source materials, history, `dist/`, `release/`, or local workspace data.
- For layout/style fixes, change the source code and run tests/builds. Do not patch the packaged app bundle directly.
