# Changelog

## 2026-09-18 — Business Baseline V1.1

- V1.0 baseline established and retained.
- Google Drive Task Assets / Deliverables added, with validated provider URLs, graceful preview failure, and CRM-only soft removal; source files are never deleted.
- Database Schema V1.1 approved.
- Authorization Model V1.1 approved.
- Node 24 LTS runtime decision (`>=24 <25`).
- Next.js full-stack monolith architecture decision.
- PostgreSQL / Neon + stable Drizzle decision; transactional Postgres.js driver.
- Railway production target.
- Bilingual business baseline reconciled at Version 1.1; original approved technical detail retained in the English baseline and technical documents.
- Phase 0 scaffolding only. No application migration or production deployment.

Ordinary progress remains immutable; HEAD-only audited administrative correction is a separate operation, not ordinary submission on behalf of another assignee.

## 2026-09-18 - Phase 1 technical foundation (V1.1)

- Transactional PostgreSQL/Postgres.js database foundation implemented.
- Better Auth 1.7.5 schema generated from shared configuration, with reviewed deterministic persistence normalization.
- Five application V1.1 tables, six enums, restrictive FKs, checks and indexes implemented.
- Initial Drizzle migration generated and reviewed; repeat generation reports no changes.
- Initial migration verified against explicitly authorized development Neon PostgreSQL; live catalogs and real PostgreSQL constraint tests passed with fixtures rolled back. Auth regeneration remains deterministic and Drizzle reports no schema drift. No production mutation.
- Closure corrected Drizzle CLI resolution, development environment loading before Vitest, and exact PostgreSQL RESTRICT error assertions; schema and migration SQL remained unchanged.

## 2026-09-18 - Phase 2 authentication and user administration (V1.1)

- Better Auth login/logout/session HTTP surface, protected application shell and canonical server-side HEAD/DEPUTY/EMPLOYEE authorization implemented.
- HEAD-only user creation, identity updates, separate role/status/password operations and append-only credential-free audit events implemented; public signup and direct unsafe library endpoints remain blocked.
- Final ACTIVE HEAD protected by PostgreSQL transaction advisory locking, with real competing-mutation verification.
- Explicit 12–128 character password policy, current-password validation for HEAD own changes, session revocation and controlled private-input initial HEAD bootstrap added.
- English/Vietnamese technical documentation updated together; approved business baseline V1.1 and the applied Phase 1 initial migration preserved.
- Closure passed 36 offline tests, three real PostgreSQL suites/tests including competing final-HEAD mutations, and eight desktop/mobile Chromium E2E tests. Live catalogs verified, auth artifacts remained deterministic, Drizzle reported no changes, and fixture cleanup left all nine tables empty.

## 2026-09-18 - Phase 3 Task Core and Lifecycle (V1.1)

- Explicit Task service, canonical session-derived actors, role-scoped joins and resource assignment/read policies implemented.
- Personal/authorized assigned creation, immutable creator, HEAD-only OPEN metadata/reassignment/cancellation and status-independent soft deletion implemented. No completion command; Daily Progress remains Phase 4.
- Task mutation/audit/required notification transactions, shared account-state/advisory coordination and row locking prevent partial writes and stale lifecycle mutations.
- Mobile-first list/detail/create/edit and confirmed HEAD actions added with Quicksand and light/dark/system themes; no Calendar/Dashboard/Drive/notification-center UI.
- English/Vietnamese technical documentation synchronized; business baseline V1.1 and the applied initial migration preserved. PostgreSQL tests include direct HTTP denial, ownership/access transfer, dependent-history retention, injected audit/notice failures and competing cancel/reassign/delete/edit.

- Phase 3 closure passed 92 offline/security tests, 12 real PostgreSQL tests and 12 desktop/mobile Chromium tests; authenticated light/dark/mobile visual verification passed. Live catalogs verified, auth artifacts stayed deterministic and Drizzle reported no changes. Cleanup left all nine tables empty, one existing migration journal entry and no test triggers. No Phase 4 implementation.

## 2026-09-18 - Phase 4 Daily Progress (V1.1)

- Current-assignee-only transactional COMPLETED/NOT_COMPLETED reporting, mandatory bounded reasons, immutable official history and derived NOT_REPORTED implemented.
- Server business-date calculation, Task/date uniqueness and same-day reassignment consequence preserved. Only Daily Progress performs normal completion.
- Dedicated HEAD latest-report/status-changing correction, paired metadata, audited reopening/completion and cancellation protection implemented; bilingual business/technical safeguards synchronized without version bump.
- Existing advisory/row locking coordinates progress with Task/account administration; tests cover competing report/cancel/reassign and real audit/task failure rollback. Mobile shadcn reporting/correction dialogs and protected detail history added. No schema change or Phase 5 functionality.

## 2026-09-19 - Phase 5 Google Drive Task Assets (V1.1)

- Google Drive Task Asset / Deliverables integration implemented with server-side service-account authentication (`google-auth-library@11.1.0`), minimal read-only metadata scope (`drive.metadata.readonly`), and Shared Drive support.
- Strict Google Drive and Google Docs host allowlisting, folder rejection, deterministic MIME classification (`IMAGE`, `VIDEO`, `DOCUMENT`, `SPREADSHEET`, `PRESENTATION`, `PDF`, `OTHER`), and canonical URL parsing implemented.
- Atomic transactional asset addition (`ADD_TASK_ASSET`) and soft removal (`REMOVE_TASK_ASSET`) implemented under existing advisory lock 24091802; external Drive reads occur outside DB transactions. Active duplicate attachments on same task rejected with 409 Conflict via database partial unique index.
- Strict authorization: HEAD may attach to any non-deleted task; DEPUTY/EMPLOYEE may attach only to own assigned OPEN task. HEAD may remove any active asset; DEPUTY/EMPLOYEE may remove only own created asset on own assigned OPEN task.
- Zero Drive mutations: CRM never calls Drive create, update, rename, delete, or permission APIs. Removing an asset in CRM leaves the Google Drive file untouched.
- Sandboxed inline previews via CSP `frame-src 'self' https://drive.google.com https://docs.google.com;`, mobile-first deliverable cards, preview dialog viewer, and "Mở trên Google Drive ↗" fallback link.
- Phase 5 passes unit tests, real PostgreSQL integration tests, desktop/mobile Chromium E2E, and zero schema migrations or drift.
