# Contributing

Thanks for considering a contribution to Resume Studio.

## Local Setup

```bash
npm install
npm test
npm run build
```

For desktop development:

```bash
npm run dev:desktop
```

## Project Rules

- Do not commit real resumes, source materials, extracted materials, generated PDFs, or local history snapshots.
- Keep AI-generated resume changes behind the pending patch flow.
- Add or update tests for bridge, MCP, storage, and security-sensitive changes.
- Prefer local-first behavior and explicit user confirmation for write operations.

## Pull Request Checklist

- `npm test` passes.
- `npm run build` passes.
- No personal data is included in the diff.
- README or docs are updated when workflows change.
