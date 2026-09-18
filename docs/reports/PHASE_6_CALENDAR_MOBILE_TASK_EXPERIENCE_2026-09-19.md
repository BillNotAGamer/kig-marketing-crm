# Phase 6 Report — Calendar & Mobile Task Experience

Date: 2026-09-19
Project: KIG Marketing CRM
Baseline: Version 1.1

---

## 1. Verdict

**PASS**

Phase 6 has successfully delivered the complete Calendar and Mobile Task Experience under approved baseline Version 1.1:

- Desktop Month and Week calendar views with Monday-first layouts, business-today highlighting, overflow handling, and deduplicated markers.
- Selected-date Agenda panel with grouped/deduplicated task markers, badges, and deep linking to `/tasks/[id]`.
- Mobile agenda-first view (~390px) featuring a compact 7-day horizontal week date strip, responsive touch targets, and zero horizontal overflow.
- Persistent Mobile Bottom Navigation (`Hôm nay`, `Công việc`, `Lịch`) integrated into the protected shell with safe-area insets.
- Operational Employee "Today" experience on `/app` surfacing today's assigned, due, and own OPEN overdue tasks deduplicated with derived Daily Progress indicators.
- Strict calendar business semantics: `assignedDate` = ASSIGNED / START ("Giao"), `dueDate` = DEADLINE ("Hạn"), same-day assigned==due combined ("Giao & Hạn"), and zero synthetic intermediate date markers.
- Strict server-side query authorization: HEAD and DEPUTY read team tasks, EMPLOYEE reads own assigned tasks only, and soft-deleted tasks are excluded.
- Zero database migrations, zero schema drift, zero Google Drive API regressions, and clean test fixture lifecycle.

---

## 2. Workspace

- **Root:** `F:\Coding\Web development\KIG Marketing CRM`
- **Branch:** `main`
- **Starting SHA:** `c66a6d67c0c6a6d878d7465070fffa1ef69e3fac`
- **Ending SHA:** `8b3b2a9976ebfb58ef3bdbcd358881b9710ce1c0`
- **Node:** `v24.19.0` (Node 24 LTS)
- **npm:** `11.17.0`
- **Working Tree:** Clean upon completion

---

## 3. Calendar Architecture

Phase 6 is implemented as an authorized, read-oriented query and presentation layer operating strictly on existing PostgreSQL tables (`task`, `task_daily_update`, `user`).

1. **Date Engine (`src/lib/calendar/date.ts`):**
   - Zero-timezone-shift date arithmetic using UTC calendar components (`Date.UTC(y, m - 1, d)`).
   - Monday-first week calculations (`startOfWeekIso`, `endOfWeekIso`, `getWeekDaysIso`).
   - Complete 35-to-42 day month grids (`getMonthGridDaysIso`) with leading and trailing dates.
   - Authoritative business date helper deriving current date in `Asia/Ho_Chi_Minh` timezone.
   - Vietnamese localized labels: Day names (`Thứ 2` ... `Chủ Nhật`), month headers (`Tháng M, YYYY`).

2. **Domain Model & Validation (`src/lib/calendar/model.ts`):**
   - Query schema (`calendarQuerySchema`) enforcing strict `YYYY-MM-DD` ISO dates, order validation (`from <= to`), and a maximum allowed query range of 62 calendar days.
   - Marker derivation (`deriveDateMarkers`): Maps `task.assignedDate` to an `ASSIGNED` marker, `task.dueDate` to a `DUE` marker, and collapses same-day tasks into a single `ASSIGNED_AND_DUE` marker without duplicating records.
   - Overdue calculation (`isTaskOverdue`): `status === "OPEN" && dueDate !== null && dueDate < businessToday`.
   - Employee Today derivation (`deriveEmployeeTodayTasks`): Categorizes tasks into `overdue`, `dueToday`, and `assignedToday` while deduplicating tasks across sections.

3. **Query Service & API (`src/lib/calendar/service.ts`, `src/app/api/calendar/route.ts`):**
   - Direct PostgreSQL range query: `(assigned_date BETWEEN from AND to) OR (due_date BETWEEN from AND to)`.
   - Batch lookup of today's official Daily Progress records from `task_daily_update` when the query window covers business today.
   - Role-scoped authorization: Enforces team tasks for HEAD/DEPUTY and assigned-only tasks for EMPLOYEE.
   - Strict HTTP endpoint (`GET /api/calendar`) enforcing canonical server sessions, returning `Cache-Control: no-store`, and rejecting invalid ranges with 400 Bad Request.

---

## 4. Date-Only Semantics

PostgreSQL columns `assigned_date`, `due_date`, and `report_date` are SQL `DATE` values stored as ISO date strings (`YYYY-MM-DD`).

- Conversion to and from JavaScript `Date` instances uses explicit UTC calendar math (`Date.UTC(year, monthIndex, day)`).
- Timezone offsets are never applied, eliminating subtle day shifts (e.g. UTC midnight shifting to the previous day in negative UTC offsets or shifting forward in positive UTC offsets).
- Leap years, month boundaries (e.g. 2026-02-28 → 2026-03-01), and year rollovers (e.g. 2026-12-31 → 2027-01-01) operate deterministically.
- Year 0000 and invalid dates (e.g. 2026-02-30) are rejected at the Zod validation boundary before hitting PostgreSQL.

---

## 5. Business Today (`Asia/Ho_Chi_Minh`)

- Business date is derived server-side via `Intl.DateTimeFormat` configured with `timeZone: "Asia/Ho_Chi_Minh"` using `en-CA` formatting (`YYYY-MM-DD`).
- Client browsers render the server-supplied business date as the authoritative reference point for "Hôm nay" across month highlights, week highlights, date strip selectors, and agenda cards.
- Server rejects any client attempt to supply an arbitrary "today" date for operational decision-making.

---

## 6. Month View

Implemented in `src/components/calendar/month-view.tsx` for desktop/tablet viewports (`sm:block`):

- Header with Vietnamese month/year title (`Tháng 9, 2026`).
- Monday-first 7-column header: `Thứ 2`, `Thứ 3`, `Thứ 4`, `Thứ 5`, `Thứ 6`, `Thứ 7`, `Chủ Nhật`.
- Navigation controls: Previous Month (`Tháng trước`), Today (`Hôm nay`), Next Month (`Tháng sau`).
- View switcher: Smooth toggling between `Tháng` (Month) and `Tuần` (Week).
- Complete grid cells with leading and trailing days from adjacent months clearly distinguished with muted styling.
- Highlight rings for business today (primary accent) and the currently selected calendar date.
- Bounded task marker container (max 2 visible markers) with an accessible `+N công việc` popover button to inspect all markers for busy dates without overflowing or distorting row heights.
- Chips communicate task title, priority indicator, lifecycle styling (e.g. line-through and muted opacity for CANCELLED, checked styling for COMPLETED), and marker type (`Giao`, `Hạn`, `Giao & Hạn`).

---

## 7. Week View

Implemented in `src/components/calendar/week-view.tsx` for desktop viewports:

- 7 all-day columns spanning Monday through Sunday.
- No synthetic hourly scheduling or timeline grids (preserving the date-only business model).
- Column headers showing Vietnamese day abbreviation, date number, and today/selected indicators.
- Direct listing of all assignment, deadline, and combined markers for each day.
- Integrated Selected-Date Agenda panel rendered alongside/below the columns for in-depth inspection of the active day.

---

## 8. Selected-Date Agenda

Implemented in `src/components/calendar/date-agenda.tsx`:

- Surfaces all visible tasks for the active calendar date.
- Clear semantic groupings:
  - `Giao ngày này` (Assigned on this date)
  - `Đến hạn ngày này` (Due on this date)
  - Tasks assigned and due on the same date appear once with a combined `Giao & Hạn` badge.
- Cards display:
  - Task title and priority badge (`Khẩn cấp`, `Cao`, `Bình thường`, `Thấp`).
  - Status badge (`Đang thực hiện`, `Hoàn thành`, `Đã hủy`).
  - Assignee identity when viewed by HEAD or DEPUTY.
  - Assigned date and due date.
  - Overdue badge (`Quá hạn`) if applicable.
  - Today's Daily Progress indicator when viewing business today.
  - Accessible "Xem chi tiết" action linking directly to `/tasks/[id]`.
- Empty state: Friendly message (`Không có công việc nào vào ngày này`) when no tasks are scheduled.

---

## 9. Employee Today Experience

Implemented in `src/components/calendar/today-view.tsx` integrated on `/app`:

- Operational hub for EMPLOYEE role:
  - **Quá hạn (Overdue):** Surfaces own OPEN tasks with due dates prior to business today.
  - **Đến hạn hôm nay (Due Today):** Surfaces own tasks due on business today.
  - **Giao hôm nay (Assigned Today):** Surfaces own tasks assigned on business today.
- Strict deduplication: A task assigned today and due today appears once with combined labels; an overdue task assigned today is not duplicated across sections.
- For HEAD and DEPUTY: Shows team-wide summary of today's workload and overdue tasks with assignee identities.
- Progress affordance: Shows today's official Daily Progress status (`Đã hoàn thành`, `Chưa hoàn thành`, `Chưa báo cáo`) and provides one-click navigation to Task Detail for reporting.
- Strict boundary: No Phase 7 dashboard metrics, team rankings, charts, or completion analytics.

---

## 10. Mobile UX / Bottom Navigation

Implemented in `src/components/navigation/mobile-nav.tsx` and `src/components/calendar/mobile-date-strip.tsx`:

- Responsive design tailored for mobile viewports (~390px, iPhone 12/13/14):
  - Desktop month grid is replaced with an agenda-first presentation.
  - 7-day compact horizontal week selector strip (`MobileDateStrip`) allowing quick swipe/tap date selection.
  - Today button for instant return to the current business date.
  - Full width agenda cards with touch targets >= 44px.
  - Zero horizontal overflow (`scrollWidth <= innerWidth`).
- Persistent Mobile Bottom Navigation:
  - Fixed at the bottom on viewports `< 640px` (`sm:hidden`).
  - Tabs:
    - `Hôm nay` (`/app`)
    - `Công việc` (`/tasks`)
    - `Lịch` (`/calendar`)
  - Active tab highlighting, accessible icons, and text labels.
  - Safe-area insets (`env(safe-area-inset-bottom)`) and proper content bottom padding (`pb-24 sm:pb-8`) on the protected shell layout to prevent nav overlapping.
  - Full support for Light, Dark, and System color themes.

---

## 11. Authorization

Calendar authorization strictly inherits Task Core resource rules:

- **HEAD:** Can query any calendar date window; sees all non-deleted team tasks with assignee names.
- **DEPUTY:** Can query any calendar date window; sees all non-deleted team tasks with assignee names.
- **EMPLOYEE:** Can query any calendar date window; sees only tasks currently assigned to self (`task.assignedToId === actor.id`). Foreign tasks assigned to other employees are filtered at the SQL level.
- **Soft Deletion:** Soft-deleted tasks (`deleted_at IS NOT NULL`) are completely excluded from calendar queries, month grids, week columns, agenda cards, and count badges.
- **Session Enforcement:** Unauthenticated requests receive 401 Unauthorized; banned/inactive users receive 401 Unauthorized.
- **Read-Only Invariant:** Calendar exposes zero mutation endpoints. No drag-and-drop status changes, no calendar-side reassignment, and no date resizing.

---

## 12. Task Lifecycle / Progress Integration

- **Task Statuses:** OPEN, COMPLETED, and CANCELLED tasks are all rendered with clear, accessible styling. CANCELLED tasks are visually muted with strikethrough styling; COMPLETED tasks display a checkmark badge.
- **Overdue Definition:** Computed dynamically as `status === "OPEN" && dueDate !== null && dueDate < businessToday`. Overdue does not mutate the database status.
- **Daily Progress:** When the calendar query includes business today, today's official report from `task_daily_update` is joined to display `COMPLETED`, `NOT_COMPLETED` (with reason preview), or derived `NOT_REPORTED`. Progress submission and administrative corrections remain exclusively on Task Detail (`/tasks/[id]`).

---

## 13. Google Drive Regression Boundary

- Calendar service and UI make zero calls to Google Drive API.
- No Google Service Account credentials or access tokens are loaded or transmitted in Calendar code.
- Task cards may indicate an already-persisted deliverable count if queried from PostgreSQL, but do not fetch Drive thumbnails or file metadata.
- Phase 5 Google Drive functionality remains intact on Task Detail with mock and live verification support.

---

## 14. Security

- Server-side parameter validation via strict Zod schema:
  - `from` and `to` must be valid `YYYY-MM-DD` ISO calendar strings.
  - `from <= to` constraint enforced.
  - Range window strictly capped at 62 calendar days; excessive windows return controlled 400 Bad Request.
- Actor identity derived exclusively from signed session cookies and fresh database user records; client-supplied actor headers are ignored.
- Database queries use parameterization via Drizzle ORM; no raw SQL string concatenation.
- HTTP response headers enforce `Cache-Control: no-store` to prevent caching of sensitive task data in proxy or browser caches.
- Error payloads are sanitized; internal database error messages are suppressed.

---

## 15. PostgreSQL Tests

Real PostgreSQL integration tests executed in `src/db/calendar.integration.ts` against the development Neon database:

- `HEAD calendar range query returns all visible team tasks with assignee names`: **PASS**
- `DEPUTY calendar range query returns all visible team tasks`: **PASS**
- `EMPLOYEE calendar range query returns only tasks assigned to self and excludes foreign employee tasks`: **PASS**
- `Soft-deleted tasks are strictly excluded from calendar queries`: **PASS**
- `Task with assignedDate inside range and dueDate outside range is included`: **PASS**
- `Task with assignedDate outside range and dueDate inside range is included`: **PASS**
- `Task with both assignedDate and dueDate outside range is excluded`: **PASS**
- `Task assigned and due on the same date returns single record without duplicates`: **PASS**
- `HTTP calendar endpoint enforces 62-day range limit and ISO date validation`: **PASS**
- Test cleanup verified: 0 lingering rows across all 9 tables.

---

## 16. E2E / Visual Verification

Full Playwright Chromium E2E suite executed across desktop and mobile devices (`e2e/calendar.spec.ts` and baseline specs):

- Desktop Month View: Monday-first layout, leading/trailing days, assignment and deadline markers, overflow popovers: **PASS**
- Desktop Week View: 7 all-day columns, Monday–Sunday navigation: **PASS**
- Same-day assignment and deadline deduplication: **PASS**
- Month navigation (Previous, Today, Next): **PASS**
- Date Agenda selection and navigation to `/tasks/[id]`: **PASS**
- Employee isolation: Foreign tasks invisible on Employee calendar: **PASS**
- Mobile View (~390px): Agenda-first layout, 7-day date strip, touch targets >= 44px, zero horizontal overflow (`scrollWidth <= innerWidth`): **PASS**
- Mobile Bottom Navigation: Active tab states, navigation between `Hôm nay`, `Công việc`, and `Lịch`: **PASS**
- Employee Today View: Categorization of Overdue, Due Today, and Assigned Today without duplicates: **PASS**
- Light and Dark theme visual rendering: **PASS**

---

## 17. Schema Stability

- Database migrations: **0 new migrations**
- Migration file `drizzle/0000_initial_v1_1.sql` unchanged.
- `npm run db:check`: **PASS** (Zero schema drift).
- `npm run auth:schema:check`: **PASS** (Auth schema deterministic).
- Tables (9): `user`, `session`, `account`, `verification`, `task`, `task_daily_update`, `task_asset`, `notification`, `audit_log`.
- Enums (6): `task_status`, `task_priority`, `task_progress_status`, `task_asset_provider`, `task_asset_type`, `notification_type`.

---

## 18. Documentation Synchronization

The following authoritative documents have been updated to reflect Phase 6 baseline:

- `docs/04-DATABASE-DESIGN.md` & `docs/04-DATABASE-DESIGN-VN.md`: Documented zero-migration query persistence, marker derivation rules, and range limits.
- `docs/05-AUTHORIZATION-MODEL.md` & `docs/05-AUTHORIZATION-MODEL-VN.md`: Documented Calendar query authorization inheritance from Task resource rules.
- `docs/CHANGELOG.md`: Recorded Phase 6 release under Version 1.1.
- `README.md`: Updated feature list with Calendar and Mobile Task experience.
- `docs/README.md` & `docs/README-VN.md`: Added Phase 6 implementation safeguards.

---

## 19. Quality Gates

| Step                 | Command                     | Result                      |
| :------------------- | :-------------------------- | :-------------------------- |
| Format               | `npm run format`            | PASS                        |
| Format Check         | `npm run format:check`      | PASS                        |
| Lint                 | `npm run lint`              | PASS (0 errors, 0 warnings) |
| Typecheck            | `npm run typecheck`         | PASS                        |
| Offline / Unit Tests | `npm run test`              | PASS (183/183 tests)        |
| PostgreSQL Tests     | `npm run test:db`           | PASS (34/34 tests)          |
| Production Build     | `npm run build`             | PASS (15 routes compiled)   |
| Playwright E2E       | `npm run test:e2e`          | PASS (24/24 tests)          |
| Auth Schema Check    | `npm run auth:schema:check` | PASS                        |
| DB Check             | `npm run db:check`          | PASS                        |
| DB Generate          | `npm run db:generate`       | PASS (No changes detected)  |
| DB Verify            | `npm run db:verify`         | PASS                        |
| Git Diff Check       | `git diff --check`          | PASS                        |

---

## 20. Known Issues

None. All Phase 6 requirements and quality gates have been satisfied.

---

## 21. Git State

- **Branch:** `main`
- **Commit:** `feat: add calendar and mobile task experience`
- **Ending SHA:** `8b3b2a9976ebfb58ef3bdbcd358881b9710ce1c0`
- **Status:** Clean working tree, no untracked or staged diagnostic artifacts.

---

## 22. Phase 7 Readiness

**READY FOR PHASE 7**

Phase 6 provides a solid, verified presentation foundation. Phase 7 (Management Dashboard, Analytics, Reporting) may proceed upon approval.
