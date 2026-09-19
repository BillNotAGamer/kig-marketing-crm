# KIG Marketing CRM

Internal Marketing task-management CRM for KIG Holding. The repository includes persistence, authentication, server-side RBAC, HEAD-only user administration, Task Core/lifecycle, Phase 4 Daily Progress, Phase 5 Google Drive Task Assets, Phase 6 Calendar & Mobile Task Experience, and Phase 7 Dashboard, Reports, Search, Notifications & Audit Viewer.

Use Node.js **24 LTS** (`>=24 <25`); `.nvmrc` and `.node-version` pin 24.19.0. npm 11.17.0 is the recorded installation tool; npm 10 and 11 are permitted. On Windows PowerShell, use `npm.cmd` if execution policy blocks `npm.ps1`.

```sh
npm ci
```

Copy `.env.example` to `.env.local` and provide private development values when later phases require them. Keep secrets out of Git. Offline checks and the placeholder require no database credentials. Phase 1 server DB/auth access validates all three required variables; BETTER_AUTH_SECRET must contain at least 32 characters. Google Drive service account credentials may be supplied in `.env.local` for live Drive API metadata access.

```sh
npm run dev
```

Open http://localhost:3000/login. Login uses the private configured development database; authenticated users enter `/app`. HEAD users can administer accounts at `/users`, view system audit logs at `/audit`, and change their own password at `/account/password`. The root placeholder remains available. Quicksand and light/dark/system themes apply throughout.

Task work is at `/tasks`, with protected detail/create and HEAD-only editing/reassignment/cancellation/soft deletion. HEAD/DEPUTY see team work; EMPLOYEE sees current assigned work only. Assignment eligibility and lifecycle are enforced by the transactional server service. Task Detail includes Phase 4 Daily Progress (reporting once per business date, immutable history, latest-report HEAD correction) and Phase 5 Google Drive Task Assets (URL allowlisting, service account metadata lookup, atomic `ADD_TASK_ASSET`/`REMOVE_TASK_ASSET` audits, active duplicate rejection, inline preview with fallback).

Calendar and mobile task experience is at `/calendar` and `/app`:

- Desktop Month and Week views (Monday-first, 7 columns, bounded task chips with overflow popover, all-day markers, business today highlight).
- Strict marker semantics: `assignedDate` = ASSIGNED/START ("Giao"), `dueDate` = DEADLINE ("Hạn"), same-day assigned==due deduplicated ("Giao & Hạn"), zero synthetic duration markers.
- Mobile agenda-first view (~390px, compact horizontal 7-day date strip, touch-friendly, zero horizontal overflow).
- Mobile persistent bottom navigation (`Hôm nay`, `Tổng quan`, `Công việc`, `Lịch`, plus responsive `Thêm` menu for `Báo cáo`, `Tìm kiếm`, `Thông báo`, and `Kiểm toán`).
- Employee "Today" experience on `/app`: assigned today, due today, own OPEN overdue tasks deduplicated, status/priority badges, and derived Daily Progress state.
- Calendar is strictly read-oriented with zero mutations; clicking a task navigates directly to `/tasks/[id]`. Zero Google Drive calls from Calendar code.

Phase 7 operational and management surfaces:

- **Dashboard** (`/dashboard`): Team Dashboard for HEAD and DEPUTY (team metrics, per-employee breakdown, overdue tasks list); Personal Dashboard for EMPLOYEE (own visible tasks only without foreign data leaks).
- **Historical Reports** (`/reports`): Persisted-evidence reporting over bounded date ranges (up to 366 days), completion ratio among submitted reports, per-reporter breakdown. No fabricated historical `NOT_REPORTED`.
- **Task Search** (`/search`): Literal substring search escaping `%` and `_`, role-scoped with status/priority/assignee filters and bounded pagination.
- **Notification Center** (`/notifications`): Header bell with unread badge, recipient isolation, and atomic mark read / mark all read.
- **Audit Log Viewer** (`/audit`): HEAD-only access, action and entity filtering, paginated audit trail with credentials and secrets stripped. Zero Google Drive calls from Dashboard, Reports, Search, Notifications, or Audit.

Validate the foundation:

```sh
npm run check
```

This runs formatting, ESLint, generated route types/TypeScript, Vitest, the production build, and Playwright test discovery. Build-time Google Font downloads need network access. Browser execution is separate:

```sh
npx playwright install chromium
npm run test:e2e
```

Playwright starts the production server, so run a build first. `npm run format` formats source and documentation; `npm run test:watch` runs Vitest interactively.

Business documentation under `docs/` is authoritative: read `docs/README.md` before implementation and `docs/README-VN.md` for stakeholder semantics. Database and authorization designs have bilingual `04-` and `05-` documents. Agent governance is in `AGENTS.md`; phase evidence is in `docs/reports/`.

Railway is the production target. Neon PostgreSQL uses the transactional Postgres.js driver with Drizzle. Phase 2 exposes only sign-in, sign-out and session retrieval through Better Auth; public registration, generic identity updates, direct admin mutations and hard deletion are unavailable.

Database setup for an explicitly authorized empty development PostgreSQL database:

```sh
npm run auth:schema:check
npm run db:generate
# Review drizzle/0000_initial_v1_1.sql before applying.
# Set private DATABASE_URL and KIG_DATABASE_ENV=development in .env.local.
npm run db:migrate
npm run db:verify
npm run test:db
```

Migration preflight refuses pre-existing public tables/enums or migration history. Stop and review an existing database rather than removing anything. Never use push as the authoritative migration workflow. The extra environment marker is an operator assertion: verify the target is development before setting it. No initial HEAD is provisioned. `npm run db:studio` opens development-only database tooling; `npm run db:check` requires no database. The initial migration and live PostgreSQL integration checks passed on the authorized development database.

Bootstrap the first HEAD only after setting private `KIG_BOOTSTRAP_HEAD_NAME`, `KIG_BOOTSTRAP_HEAD_EMAIL` and `KIG_BOOTSTRAP_HEAD_PASSWORD` in the ignored local environment, together with `KIG_DATABASE_ENV=development` and the required server environment:

```sh
npm run auth:bootstrap-head
```

The command refuses when an ACTIVE HEAD exists, never prints credentials, and atomically creates the credential account and bootstrap audit evidence. Passwords must contain 12–128 characters and cannot be entirely whitespace; passwords are never trimmed. No default credentials or production seed exists. Production bootstrap requires a separately reviewed operator workflow at deployment time; this command currently permits development only.

For the initialized development database, run `npm run db:verify` and `npm run test:db`; do not repeat the initial migration command. The PostgreSQL suite includes authentication, Task authorization/ownership/lifecycle/atomicity, endpoint denial and competing HEAD/Task mutations. These security tests require an isolated development baseline without a permanent ACTIVE HEAD. Browser tests start a loopback production server matching `BETTER_AUTH_URL`, serialize contexts to preserve production login rate limits, and create/clean isolated random fixtures. Run them before provisioning a permanent development HEAD. Credential-bearing browser traces are disabled. Phases 2, 3 and 4 add no migration. Progress suites cover date/uniqueness/correction, real rollback and competing lifecycle transitions; browser progress scenarios deliberately cool down between role-heavy logins to preserve the production sign-in limiter.
