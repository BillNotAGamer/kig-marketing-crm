# Changelog

## 2026-09-19 — Phase 8 security and production hardening

- Added exact-origin/JSON mutation enforcement, restrictive security headers, sanitized database readiness, production environment validation and safe bootstrap/incremental migration separation.
- Added bounded Google Drive My Drive allowed-folder ancestry enforcement without changing the read-only scope or performing Drive writes.
- Added synchronized production-readiness runbooks; Business Baseline remains Version 1.1 and the database schema remains unchanged.

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

## 2026-09-19 - Phase 6 Calendar & Mobile Task Experience (V1.1)

- Calendar query engine and API implemented (`/api/calendar` with strict ISO `YYYY-MM-DD` bounds, maximum 62-day range limit, `no-store` caching).
- Strict calendar business semantics implemented: `assignedDate` = ASSIGNED/START marker ("Giao"), `dueDate` = DEADLINE marker ("Hạn"), same-day assigned==due deduplicated ("Giao & Hạn"), zero synthetic intermediate date markers.
- Role-scoped query authorization: HEAD and DEPUTY read all team tasks; EMPLOYEE reads only own assigned tasks; soft-deleted tasks are strictly excluded.
- Desktop Month view (Monday-first grid, 7 columns, leading/trailing month padding, business today highlight, selected date highlight, bounded task chips with overflow "+N công việc" popover).
- Desktop Week view (Monday–Sunday 7 columns, all-day markers, no hourly grid).
- Selected-date agenda panel with grouped/deduplicated task cards and direct navigation to `/tasks/[id]`.
- Mobile agenda-first presentation (~390px, compact 7-day horizontal week date strip, responsive touch targets >= 44px, zero horizontal overflow).
- Mobile persistent bottom navigation (`Hôm nay`, `Công việc`, `Lịch`) integrated into protected shell with safe-area insets, route matching, and light/dark theme support.
- Operational Employee Today experience on `/app`: assigned today, due today, own OPEN overdue tasks deduplicated, status/priority badges, today's derived Daily Progress status (`COMPLETED`, `NOT_COMPLETED`, `NOT_REPORTED`).
- Date-only arithmetic without timezone shifts, business date derived from `Asia/Ho_Chi_Minh`. Zero Google Drive calls from Calendar code.
- Zero database migrations or schema drift (`drizzle/0000_initial_v1_1.sql` unchanged). Full unit, PostgreSQL integration, and desktop/mobile Chromium E2E test coverage.

## 2026-09-19 - Phase 7 Dashboard, Reports, Search, Notifications & Audit Viewer (V1.1)

- Role-aware Dashboard implemented (`/dashboard`, `GET /api/dashboard`): Team Dashboard for HEAD and DEPUTY with team metrics and per-employee operational breakdown; Personal Dashboard for EMPLOYEE restricted to own visible tasks without foreign data leaks.
- Today's operational task snapshot semantics: server-derived for `Asia/Ho_Chi_Minh`, includes tasks where `assignedDate <= businessToday` AND (`status === 'OPEN'` OR has an official `task_daily_update` on `businessToday`).
- Same-day reassignment attribution: submitted report is attributed to actual reporter `report.userId`; unreported task is attributed to current `task.assignedToId`; reassigned assignee receives no duplicate or false `NOT_REPORTED`.
- Current overdue metric derived dynamically (`status === 'OPEN' && dueDate !== null && dueDate < businessToday`). Never persisted.
- Historical Operational Reports implemented (`/reports`, `GET /api/reports`): strictly based on persisted facts over bounded date ranges (max 366 days, default 30 days ending `businessToday`). Zero fabricated historical `NOT_REPORTED` metrics. Per-reporter breakdown grouped by `task_daily_update.userId` preserving representation of historical/inactive users.
- Task Search implemented (`/search`, `GET /api/search/tasks`): literal substring search escaping `%` and `_`, role-scoped (EMPLOYEE restricted to own assigned tasks), status/priority/assignee filters, and bounded pagination (default 20, max 50).
- Notification Center implemented (`/notifications`, `/api/notifications/*`): user-isolated to canonical session recipient, unread badge indicator in header, atomic mark single/all as read using committed schema with existing `read_at` and index. Preserves safe historical notification snapshots without leaking fresh task data after reassignment.
- Audit Log Viewer implemented (`/audit`, `GET /api/audit`): restricted strictly to HEAD (`requireRole("HEAD")` and server-side 403 for DEPUTY and EMPLOYEE). Append-only; safe projections strip credential secrets, passwords, and private keys.
- Navigation enhanced: desktop header navigation with NotificationBell; responsive mobile navigation (~390px) with 4 primary tabs (`Hôm nay`, `Tổng quan`, `Công việc`, `Lịch`) and a responsive `Thêm` (More) sheet for secondary destinations (`Báo cáo`, `Tìm kiếm`, `Thông báo`, and `Kiểm toán` for HEAD).
- Zero database migrations or schema drift (`drizzle/0000_initial_v1_1.sql` unchanged, 9 tables, 6 enums). Zero Google Drive calls from Dashboard, Reports, Search, Notifications, or Audit.
