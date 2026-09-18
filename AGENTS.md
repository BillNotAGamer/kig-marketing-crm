<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# KIG repository governance

- Before business implementation, MUST read `docs/README.md`.
- Consult `docs/README-VN.md` to validate stakeholder semantics; Vietnamese business documentation is primary.
- Preserve every approved invariant. Never silently modify business rules.
- When business behavior changes, update BOTH English and Vietnamese documentation and the corresponding tests.
- Enforce authentication and permissions server-side. Hidden buttons and navigation are never authorization.
- Never overwrite `createdById` when editing a task.
- Never introduce hard deletion where soft deletion or user deactivation is specified.
- User deactivation uses Better Auth `banned`; do not add duplicate `isActive` or account-status fields.
- Never delete or modify Google Drive source content when removing a CRM asset association.
- Interpret all business dates in `Asia/Ho_Chi_Minh`; keep DATE separate from event TIMESTAMPTZ.
- If documentation and implementation disagree, report the discrepancy rather than silently choosing one.
- Keep the authoritative application root at `F:\Coding\Web development\KIG Marketing CRM`; use Node 24 LTS and npm.
- Phase 0 contains no business implementation, database schemas/migrations, authentication routes, Drive credentials/API calls, or deployment.
