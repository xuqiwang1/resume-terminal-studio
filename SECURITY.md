# Security

Resume Studio handles private resume data and local source materials. Please report security issues privately instead of opening a public issue.

## Security Boundaries

- Runtime data lives in the local workspace and should not be committed.
- The local bridge uses a per-session token in the desktop app.
- AI-written body edits should go through `propose_edit` or `propose_batch_edit` and pending patch confirmation.
- File-opening endpoints validate file names to prevent path traversal.

## Reporting

If you find a vulnerability, contact the maintainer through GitHub once the repository is public. Include:

- Affected version or commit.
- Reproduction steps.
- Impact.
- Suggested fix, if available.

Do not include private resumes or source materials in reports.
