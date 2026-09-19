# Phase 7 Report — Dashboard, Reports, Search, Notifications & Audit Viewer

**Authoritative Project Workspace:** `F:\Coding\Web development\KIG Marketing CRM`  
**Execution Date:** 2026-09-19  
**Business Baseline:** Version 1.1  
**Authoritative Starting SHA:** `cbeccc663ae892da4cb298518cda1667863e1684`  
**Target Commit Message:** `feat: add dashboard reports search and notifications`

---

## 1. Verdict

**PASS**

All 22 objectives of Phase 7 have been successfully implemented, verified, and integrated into the verified Phase 7 Next.js application baseline for KIG Marketing CRM. The system adheres strictly to the approved Version 1.1 business baseline, introduces zero database schema migrations, and preserves the complete historical and invariant boundaries established across Phases 0–6.

---

## 2. Workspace

- **Repository Root:** `F:\Coding\Web development\KIG Marketing CRM`
- **Git Branch:** `main`
- **Starting HEAD SHA:** `cbeccc663ae892da4cb298518cda1667863e1684`
- **Node Runtime:** Node.js v24.19.0 (Node 24 LTS)
- **Package Manager:** npm 11.17.0
- **Working Tree State:** Clean closure semantics (only authoritative Phase 7 files and documentation modified). As specified in Section A and Section AT, the exact final ending commit SHA is not self-referentially embedded inside this report, but is captured immediately after commit via `git rev-parse HEAD` and reported in the final delivery response.

---

## 3. Dashboard Architecture

The Dashboard is implemented as a server-authoritative operational monitoring surface located at `/dashboard` (with API endpoint `GET /api/dashboard`).

- **Architecture:** Protected route rendered via Next.js App Router server component (`src/app/(protected)/dashboard/page.tsx`), calling the transactional service `getDashboard().getDashboardData(headers)` inside `src/lib/dashboard/service.ts`.
- **Database Access:** Executes single, advisory-locked (`pg_advisory_xact_lock_shared(24091802)`) PostgreSQL queries through Drizzle ORM. Zero N+1 query patterns; aggregates and joins all operational task candidates, today's daily progress records, and active/historical users.
- **Client Presentation:** Rendered by `DashboardView` (`src/components/dashboard/dashboard-view.tsx`), featuring responsive metric cards, per-employee breakdown tables for team roles, and dynamic overdue task listings.

---

## 4. Today Operational Metric Semantics

Today's Dashboard provides an operational progress snapshot strictly distinct from historical task lifecycles:

- **Business Today:** Derived exclusively on the server using `Asia/Ho_Chi_Minh` timezone (`currentBusinessDate(clock)`). Browser timezones and client-supplied dates are rejected.
- **Operational Task Set:** Unique non-deleted tasks (`deletedAt IS NULL`) satisfying:
  $$\text{assignedDate} \le \text{businessToday} \quad \text{AND} \quad (\text{status} = \text{'OPEN'} \;\lor\; \exists\, \text{official report on } \text{businessToday})$$
- **Inclusions and Exclusions:**
  - Tasks assigned in the future are strictly excluded.
  - Tasks completed before today with no report today do not inflate operational metrics.
  - Tasks completed today via daily progress remain represented in today's statistics.
  - Tasks cancelled today after submitting a progress report today retain their report record.
- **Metric Definitions:**
  - **TOTAL:** Count of unique tasks in today's operational set.
  - **COMPLETED:** Count of tasks with an official `task_daily_update` on `businessToday` having `status = 'COMPLETED'`.
  - **NOT_COMPLETED:** Count of tasks with an official `task_daily_update` on `businessToday` having `status = 'NOT_COMPLETED'`.
  - **NOT_REPORTED:** Count of tasks in today's operational set with no official report on `businessToday`.
  - **COMPLETION RATE:** $\frac{\text{COMPLETED}}{\text{TOTAL}} \times 100\%$ (if $\text{TOTAL} = 0$, rate $= 0\%$).
- No synthetic `NOT_REPORTED` status is ever written to the database; it is derived at query time.

---

## 5. Same-Day Reassignment Attribution

Phase 7 preserves the Phase 4 invariant: _exactly one official progress report per task per business date_.

When Task A reports on `businessToday` under Employee X and is subsequently reassigned to Employee Y on the same day:

1. No second report is expected for Employee Y on that day.
2. Today's task total includes Task A exactly once.
3. The submitted report is attributed to the actual reporter stored in `task_daily_update.userId` (Employee X).
4. Employee Y receives no false `NOT_REPORTED` count for Task A.
5. In per-employee team aggregation:
   - If an official report exists: attribute `COMPLETED` / `NOT_COMPLETED` to `report.userId`.
   - If no report exists: attribute `NOT_REPORTED` to current `task.assignedToId`.

---

## 6. HEAD / DEPUTY Dashboard

For actors with team read permissions (HEAD and DEPUTY):

- Displays aggregate metrics across the entire team (`isTeamView = true`).
- Displays a dedicated table: "Chi tiết công việc theo nhân viên" listing all team members:
  - Columns: Nhân viên, Tổng việc, Đã xong, Chưa xong, Chưa báo, Tỷ lệ (%), Quá hạn.
  - Inactive historical users (`banned = true`) owning visible historical records or overdue tasks are truthfully represented with visual indicators rather than silently hidden.
- Displays "Danh sách công việc đang quá hạn" listing all current OPEN tasks where `dueDate < businessToday`.
- Strictly omits rankings, gamification, leaderboards, or "best employee" metrics.

---

## 7. EMPLOYEE Dashboard

For actors with the EMPLOYEE role:

- Strictly scoped server-side to own visible tasks (`task.assignedToId === actor.id`).
- Renders the identical metric vocabulary: Tổng việc, Đã xong, Chưa xong, Chưa báo, Tỷ lệ (%), Quá hạn.
- Team-wide breakdown tables, other employees' operational metrics, and foreign task listings are completely withheld server-side.
- Zero ability for an employee to infer foreign task counts or workloads.

---

## 8. Historical Reports

Historical operational reporting is provided at `/reports` (API: `GET /api/reports`):

- **Range Filters:** `from` and `to` ISO date parameters. Defaults to the last 30 calendar days ending `businessToday`. Maximum window is strictly capped at 366 calendar days.
- **Persisted Metrics:**
  - `submittedReportsCount`: Total `task_daily_update` records in range.
  - `completedReportsCount`: Total submitted reports with `status = 'COMPLETED'`.
  - `notCompletedReportsCount`: Total submitted reports with `status = 'NOT_COMPLETED'`.
  - `completionRatioSubmitted`: $\frac{\text{completedReportsCount}}{\text{submittedReportsCount}} \times 100\%$. Clearly labeled as "Tỷ lệ hoàn thành trong báo cáo đã nộp" to distinguish it from today's operational completion rate.
  - `tasksCompletedInRange`: Non-deleted tasks with `completedAt` timestamp in range.
  - `tasksAssignedInRange`: Non-deleted tasks with `assignedDate` in range.
  - `currentOverdueCount`: Current OPEN overdue tasks, explicitly labeled as current state.
- **Per-Reporter Breakdown:** For HEAD and DEPUTY, a table grouped by `task_daily_update.userId` shows each reporter's historical submissions and completion ratio. Inactive users remain visible if historical reports exist.

---

## 9. Historical Reporting Limitations

In strict adherence to baseline Version 1.1:

- The system persists real events (task creation, updates, and daily progress submissions), but does not maintain an immutable daily snapshot of every task's assignment state across arbitrary past dates.
- Consequently, arbitrary historical "NOT_REPORTED" counts cannot be reconstructed reliably after reassignments and lifecycle changes.
- Phase 7 strictly refuses to fabricate synthetic historical `NOT_REPORTED` metrics. Historical reports report only verified, persisted facts.

---

## 10. Search

Protected Task Search is implemented at `/search` (API: `GET /api/search/tasks`):

- **Searchable Fields:** `title` and `description` (plus assignee display name for HEAD and DEPUTY).
- **Security & Literal Wildcard Handling:** User query is trimmed (2–100 characters). SQL wildcard characters `%` and `_` are explicitly escaped (`escapeSqlLikePattern`) so queries like `"100%"` match literal percent signs and never trigger wildcard matching.
- **Role Isolation:** EMPLOYEE queries are joined with `task.assignedToId = actor.id` at the database level. Foreign tasks never match, even when exact titles are queried. Result counts never leak foreign existence.
- **Soft-Deleted Exclusion:** Soft-deleted tasks (`deletedAt IS NOT NULL`) are strictly excluded.
- **Bounded Pagination:** Default 20, max 50 items per page, with deterministic ordering (`updatedAt DESC, id DESC`).
- **Result Navigation:** Cards provide direct links to `/tasks/[id]`. No Google Drive metadata or daily progress reasons are fetched during search.

---

## 11. Notification Center

The Notification Center is exposed at `/notifications` (API: `GET /api/notifications`):

- **Events Supported:** Existing Phase 3 notification types (`TASK_ASSIGNED`, `TASK_UPDATED`, `TASK_REASSIGNED`, `TASK_CANCELLED`). Phase 7 introduces no new notification types and emits zero notifications for read views.
- **Presentation:** Header notification bell with unread badge counter in desktop and mobile shells. Responsive list displaying newest-first notifications with timestamps and links to tasks.

---

## 12. Notification Authorization / Read State

- **Recipient Isolation:** Every notification query enforces `userId === actor.id` derived strictly from the canonical session. HEAD and DEPUTY cannot read or mark other users' notifications.
- **Read State Implementation:** The committed PostgreSQL schema already included `read_at: timestamp with time zone NULL` and index `notification_user_read_created_idx`. Phase 7 utilizes this existing column with zero schema drift.
- **Atomic Mutations:**
  - Mark one read: `POST /api/notifications/[id]/read` atomically updates `readAt` where `id = notificationId AND userId = actor.id AND readAt IS NULL` via `.returning({ id: notification.id })`.
  - Mark all read: `POST /api/notifications/read-all` atomically updates all unread notifications for the session user.
  - Mutations require exact origin verification.
- **Data Safety:** Historical notifications display their persisted message snapshot. Clicking the task link executes full task authorization (returning 404 if the user is no longer assigned or authorized). Notifications cannot be used as an authorization bypass.

---

## 13. Audit Log Viewer

Exposed at `/audit` (API: `GET /api/audit`):

- **Role Authorization:** HEAD only. Protected by `requireRole("HEAD")` on page load (redirects non-HEAD to `/access-denied`) and HTTP 403 Forbidden on the API.
- **Append-Only Immutability:** Audit records are strictly read-only. Zero audit mutation, update, or deletion endpoints exist.
- **Data Sanitization:** Safe projections (`sanitizeAuditData`) recursively strip password hashes, session tokens, Better Auth secrets, Google private keys, and raw credentials before returning DTOs.
- **Filters & Pagination:** Supports filtering by `action`, `entityType`, `actorUserId`, and date range with bounded pagination (default 25, max 50) and newest-first ordering.

---

## 14. Authorization

All Phase 7 surfaces inherit server-authoritative resource visibility:

| Surface                              | HEAD                   | DEPUTY                 | EMPLOYEE                                  |
| :----------------------------------- | :--------------------- | :--------------------- | :---------------------------------------- |
| **Dashboard** (`/dashboard`)         | Team View              | Team View              | Personal View (Own visible tasks only)    |
| **Reports** (`/reports`)             | Team Reports           | Team Reports           | Personal Reports (Own visible tasks only) |
| **Search** (`/search`)               | Team Search            | Team Search            | Own assigned tasks only                   |
| **Notifications** (`/notifications`) | Own notifications only | Own notifications only | Own notifications only                    |
| **Audit Log** (`/audit`)             | Allowed (Read-only)    | FORBIDDEN (403)        | FORBIDDEN (403)                           |

---

## 15. Security

- **Server-Side Enforcement:** Every endpoint derives actor identity and role from verified session cookies. Client-supplied actor IDs, roles, and recipient IDs are rejected.
- **Origin & CSRF Controls:** All POST mutation endpoints enforce exact origin header verification.
- **SQL Injection Prevention:** All search, dashboard, report, notification, and audit queries use parameterized Drizzle queries. No raw SQL concatenation.
- **Credential Hygiene:** Audit logs, DTOs, and error payloads never leak tokens, keys, passwords, or session cookies.
- **Zero Drive Calls:** Dashboard, Reports, Search, Notifications, and Audit viewer execute zero Google Drive API calls.

---

## 16. PostgreSQL Tests

All 8 integration test suites in `src/db/` pass against the real Neon PostgreSQL development database:

- `src/db/dashboard-reports.integration.ts` (8/8 PASS)
  - Dashboard role scoping and operational metrics calculation.
  - Same-day reassignment attribution semantics (reporter vs assignee).
  - Exclusion of future-assigned and past-completed tasks without today reports.
  - Historical reports using persisted evidence only without fabricated `NOT_REPORTED`.
  - Report date range validation (max 366 days, `from <= to`).
  - Task search role isolation, filters, soft-deleted exclusion, and literal `%`/`_` wildcard escaping.
  - Notification recipient isolation, unread count, and atomic mark read / mark all read.
  - Audit log HEAD-only access, safe projection, and 403 rejection for DEPUTY and EMPLOYEE.
- Retained Phase 1–6 suites (34/34 PASS):
  - `tasks.integration.ts` (9/9)
  - `progress.integration.ts` (9/9)
  - `assets.integration.ts` (7/7)
  - `calendar.integration.ts` (6/6)
  - `auth.integration.ts` (1/1)
  - `head-concurrency.integration.ts` (1/1)
  - `constraints.integration.ts` (1/1)
- **Total PostgreSQL Integration Tests:** 42/42 PASS (100% green).

---

## 17. E2E / Visual Verification

- **Full Playwright Suite:** All 36 tests pass across both `desktop-chromium` (1280×720) and `mobile-chromium` (Pixel 7 / 390px):
  - `dashboard-reports.spec.ts` (12/12): Dashboard team/personal view, Reports range filters, Task Search with navigation, Notification Center mark read, Audit Log HEAD authorization, light/dark themes.
  - `assets.spec.ts` (4/4): Google Drive asset attachments and removal.
  - `auth-users.spec.ts` (4/4): User administration and access denial.
  - `calendar.spec.ts` (4/4): Calendar views, date agendas, and navigation.
  - `foundation.spec.ts` (2/2): Root redirect and login accessibility.
  - `progress.spec.ts` (4/4): Daily progress submission, non-completion reasons, and HEAD corrections.
  - `tasks.spec.ts` (6/6): Task lifecycle, assignment, editing, and cancellation.
- **Visual Verification:**
  - `scrollWidth <= innerWidth` verified across all pages at ~390px viewport.
  - Light mode and Dark mode render flawlessly using `next-themes`.
  - Mobile bottom navigation features 4 primary tabs (`Hôm nay`, `Tổng quan`, `Công việc`, `Lịch`) and a responsive `Thêm` slide-up sheet for secondary routes without overcrowding.

---

## 18. Schema Stability

- **Migrations Added:** ZERO (`drizzle/0000_initial_v1_1.sql` unchanged).
- **Tables:** Exactly 9 tables maintained:
  1. `account`
  2. `audit_log`
  3. `notification`
  4. `session`
  5. `task`
  6. `task_asset`
  7. `task_daily_update`
  8. `user`
  9. `verification`
- **Enums:** Exactly 6 enums verified against PostgreSQL `pg_type` catalog:
  1. `notification_type`
  2. `task_asset_provider`
  3. `task_asset_type`
  4. `task_priority`
  5. `task_progress_status`
  6. `task_status`
- **Schema Generation Gate:** Executed `npm run db:generate` → `No schema changes, nothing to migrate 😴`.
- **Schema Drift:** Verified ZERO drift via `drizzle-kit check`, `npm run auth:schema:check`, and `npm run db:verify`.
- **Fixture Cleanup & Triggers:** Verified 0 test-owned rows remaining in all 9 application/auth tables and 0 persistent test triggers in `information_schema.triggers`.

---

## 19. Documentation Synchronization

Bilingual documentation updated to record Phase 7 baseline:

- `docs/04-DATABASE-DESIGN.md` & `docs/04-DATABASE-DESIGN-VN.md`: Persistence models for Dashboard operational sets, historical reporting limits, literal search escaping, notification read state, and sanitized audit logs.
- `docs/05-AUTHORIZATION-MODEL.md` & `docs/05-AUTHORIZATION-MODEL-VN.md`: Server-side authorization rules for Dashboard, Reports, Search, Notifications, and Audit Log.
- `docs/CHANGELOG.md`: Recorded Phase 7 release under Version 1.1.
- `docs/README.md` & `docs/README-VN.md`: Added Phase 7 implementation safeguards.
- `README.md`: Updated root project overview with Phase 7 operational surfaces.

---

## 20. Quality Gates

| Quality Gate                    | Command                     | Result                                                |
| :------------------------------ | :-------------------------- | :---------------------------------------------------- |
| **Code Formatting**             | `npm run format:check`      | PASS                                                  |
| **ESLint**                      | `npm run lint`              | PASS (0 errors, 0 warnings)                           |
| **TypeScript**                  | `npm run typecheck`         | PASS (0 errors)                                       |
| **Offline Unit/Security Tests** | `npm run test`              | PASS (199/199 tests across 15 files)                  |
| **Database Integration Tests**  | `npm run test:db`           | PASS (42/42 tests across 8 files)                     |
| **Production Build**            | `npm run build`             | PASS (Turbopack, 26 routes)                           |
| **E2E Acceptance Suite**        | `npm run test:e2e`          | PASS (36/36 tests, Desktop & Mobile Chromium)         |
| **Auth Schema Check**           | `npm run auth:schema:check` | PASS (Zero drift)                                     |
| **Database Schema Check**       | `npm run db:check`          | PASS (Zero drift)                                     |
| **Schema Generation Gate**      | `npm run db:generate`       | PASS (No schema changes, nothing to migrate)          |
| **Database Verification**       | `npm run db:verify`         | PASS (Neon development database clean, 0 orphan rows) |
| **Git Diff Check**              | `git diff --check`          | PASS (Zero whitespace / conflict errors)              |

---

## 21. Known Issues

None. All Phase 7 operational requirements, security boundaries, and quality gates pass with zero defects.

---

## 22. Git State

- **Starting SHA:** `cbeccc663ae892da4cb298518cda1667863e1684`
- **Intended Commit Message:** `feat: add dashboard reports search and notifications`
- **Closure Semantics:** Clean working tree closure. The exact authoritative ending commit SHA is retrieved immediately after commit via `git rev-parse HEAD` and presented in the final delivery response.

---

## 23. Phase 8 Readiness

Phase 7 is fully complete and verified. The repository is ready for Phase 8 planning when authorized. Phase 8 has NOT been started.
