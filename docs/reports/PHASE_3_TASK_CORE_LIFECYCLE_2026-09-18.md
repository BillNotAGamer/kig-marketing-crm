# Phase 3 — Task Core & Lifecycle

Date: 2026-09-18. Approved business baseline: V1.1, unchanged.

## 1. Verdict

PASS

All implementation, offline/security, real PostgreSQL, Chromium, visual, schema stability and secret-review gates passed. Phase 3 is closed by the coherent commit containing this report. No Phase 4 implementation.

## 2. Workspace

- Workspace and Git root: `F:\Coding\Web development\KIG Marketing CRM`.
- Branch: `main`; initial working tree clean.
- Starting SHA: `5ca12b4e64499750bd2758d4d3dc5fb1278a4264`, resolved directly with git rev-parse HEAD before any modifications.
- Ending SHA: the Phase 3 commit containing this report at refs/heads/main; the final response records its resolved SHA. Embedding the containing commit's own SHA would change it.
- Node 24.19.0; npm 10.8.1 in sandbox, 11.17.0 in authorized verification environment. Runtime policy >=24 <25 preserved.
- Existing documents, tests, applied initial migration and schema preserved; no unrelated change, reset, remote change or push.

## 3. Task Architecture

`src/lib/tasks/service.ts` exposes createTask, getTask, listTasks, listAssignees, updateTaskMetadata, reassignTask, cancelTask, softDeleteTask. No unrestricted patch or generic status mutation. Strict Zod schemas, explicit resource policies and safe DTO types live alongside the service. Server-only runtime/page wrappers supply DB/environment; client components import only DTO types and safe priority constants.

GET/POST `/api/tasks` lists/creates; GET `/api/tasks/assignees` supplies eligible selectors; GET `/api/tasks/[id]` reads detail. POST `/api/tasks/[id]/metadata`, `/reassign`, `/cancel`, `/soft-delete` maps to one explicit command. Unknown commands fail; no HTTP hard-delete export. APIs return no-store responses. Creator and assignee are joined once with ID/name projections, avoiding N+1 and auth/account fields.

## 4. Authorization

Every operation uses Phase 2 canonical server session/user helpers. Clients cannot supply actor/role/creator authority. Missing, banned or invalid-role actors are rejected. Explicit task grants: HEAD all eight approved permissions; DEPUTY create-self/create-for-others/read-self/read-team; EMPLOYEE create-self/read-self. No wildcard.

HEAD/DEPUTY view non-deleted team tasks; EMPLOYEE only current assigned tasks. All normal list/detail SQL excludes deletedAt!=null. Unauthorized/nonexistent/deleted detail returns identical 404 without content. Protected pages check session server-side; edit checks HEAD before reading resource data. Hidden navigation/control is supplementary.

## 5. Task Creation

HEAD assigns any ACTIVE user including self. DEPUTY self or ACTIVE EMPLOYEE only, never HEAD/another DEPUTY. EMPLOYEE self only; unauthorized requested assignee is rejected rather than replaced. All targets are canonical/existing/banned=false and validated again under transaction locking.

Server sets createdById=actor.id, OPEN, null completedAt/cancelledAt/deletedAt/deletedById. Strict input accepts title, description, assignedDate, dueDate, priority, assignedToId. Optional description/dueDate default null; priority defaults NORMAL. Title trimmed/nonblank/max 200; description bound 10,000; valid ISO DATE ordering, with PostgreSQL-incompatible year 0000 rejected; UUID IDs; exact priority enum. Privileged extras fail. Selectors expose only eligible ACTIVE ID/name/role; Employee has fixed self assignment.

## 6. Task Ownership

createdById is original creator and remains immutable during HEAD metadata editing, reassignment, cancellation and soft deletion. assignedToId is operational ownership. Tests explicitly create as Employee A, edit as HEAD, reassign to Employee B and prove creator A remains while A loses access and B gains access. HEAD/DEPUTY retain team reads. DTOs intentionally expose creator/assignee IDs and names only.

## 7. Metadata Editing

HEAD only, OPEN/non-deleted only; full validated metadata payload consists of title/description/assignedDate/dueDate/priority. No assignee/creator/lifecycle/delete fields. Reassignment is separate. UPDATE_TASK before/after audit and required TASK_UPDATED notice share the transaction. Non-HEAD direct attempts fail; CANCELLED/COMPLETED edits fail.

## 8. Reassignment

HEAD only, locked OPEN/non-deleted task, existing ACTIVE new assignee, different from old assignee. Creator remains unchanged. REASSIGN_TASK audit contains before/after ownership, and TASK_REASSIGNED notifies the new assignee, including a reassignment to the acting HEAD. Old Employee access ends immediately through current-assignee SQL filtering. Inactive targets and non-HEAD direct API calls fail.

## 9. Cancellation

HEAD-only OPEN→CANCELLED: cancelledAt now, completedAt null, deletedAt unchanged. CANCEL_TASK audit and TASK_CANCELLED notice for another-user assignee are atomic. Repeat cancellation, later metadata edit and reassignment fail. CANCELLED remains visible business history until separately soft-deleted.

## 10. Soft Deletion

HEAD-only dedicated command, any non-deleted lifecycle state. Sets paired deletedAt/deletedById and updatedAt; retains status, creator, row and dependent daily/asset/audit history. No production DELETE FROM task. Normal list/detail/direct URL hides the task; further mutations fail. Tests prove OPEN/CANCELLED/COMPLETED rows retain state and dependencies after deletion. Historical completed/daily/asset records are test-only fixtures, not implemented workflows. No restore.

## 11. Lifecycle Protection

Only creation to OPEN and OPEN→CANCELLED are production Phase 3 lifecycle transitions. No completion function, status endpoint, completion reporting, progress submission/correction or Daily Progress UI. Strict create/metadata/reassign/empty cancel/delete schemas reject status/creator/timestamps/deletion fields; unknown completion commands fail. Existing COMPLETED enum renders safely and remains reserved for Phase 4 Daily Progress.

## 12. Audit / Notifications

Append-only application events: CREATE_TASK, UPDATE_TASK, REASSIGN_TASK, CANCEL_TASK, DELETE_TASK. Whitelisted business snapshots contain task metadata, ownership, dates/status and lifecycle/removal evidence, never unrelated user/account/session credentials.

Notifications: TASK_ASSIGNED for another-user creation; TASK_UPDATED for another-user metadata edit; TASK_REASSIGNED for the new assignee; TASK_CANCELLED for another-user cancellation. No redundant create/update/cancel self notices, deletion type or notification-center UI. Safe title/entity ID/recipient/type only; future notification navigation must re-authorize the task.

Mutation+audit+required notification is one PostgreSQL transaction. Real PostgreSQL failure triggers reject audit or notice insertion and prove creation/reassignment rollback with no partial records. Test DDL rolls back; temporary trigger functions are connection-scoped and disappear on pool closure. No migration or live schema drift.

## 13. Concurrency

Mutations acquire Phase 2 advisory transaction lock 24091802 exclusively before fresh actor/target reads, then lock existing task FOR UPDATE and check state. Reads acquire the shared variant before session/role-scoped SQL. Account role/deactivation changes and assignments are coordinated; canonical ACTIVE eligibility does not use stale UI data. Lock order: advisory account lock, task row. READ COMMITTED sees preceding committed state after waiting.

This first internal foundation intentionally serializes Task writes globally, a throughput tradeoff documented in both technical languages. Row locking also protects stale lifecycle. Tests hold cancellation/deletion before commit, prove a competing transaction actually waits via pg_locks, then commit and prove reassignment rejects 409 and metadata edit rejects 404 with no audit/notice. Reassignment committed before cancellation may form a valid sequential history; both never blindly use stale OPEN state.

## 14. Tests

| Suite                      | Evidence                                                                                                                                  |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Offline/unit/Task security | PASS: 92 tests in 6 files; 56 new Task permission/resource/strict-input/calendar-date tests; all 36 baseline tests retained               |
| PostgreSQL first full run  | PASS: 11 tests in 4 files, 165.84 seconds; existing auth/schema/final-HEAD coverage plus Task security/ownership/lifecycle/rollback/races |
| PostgreSQL final run       | PASS: 12 tests in 4 files, 223.80 seconds; nine Task cases plus three retained baseline suites/tests                                      |
| Chromium first full run    | PASS: 12 tests, desktop/mobile, 3.4 minutes; baseline 8 retained plus 4 Task browser scenarios                                            |
| Chromium final run         | PASS: 12 tests in 3 files, 3.4 minutes, final production build; actual completion/hard-delete/foreign-assignment HTTP denial              |

Task integration covers allowed creation for each role, forbidden/inactive targets, eligible selectors, team/current-assignee reads, ownership transfer, safe DTOs, authenticated/origin/privileged-field boundaries, banned actors, HEAD metadata/reassignment, cancellation/history, soft-delete/dependent retention, transactional rejection and races. Fixtures use random account namespaces/UUID task titles and clean owned dependencies. No permanent credentials/data.

## 15. UI / Mobile

Protected `/tasks` cards, `/tasks/[id]` detail, `/tasks/new` creation and HEAD `/tasks/[id]/edit` metadata edit. HEAD detail has dedicated reassign and confirmed cancel/delete controls; non-HEAD has none. Status/priority text distinguishes OPEN/CANCELLED and safely renders COMPLETED; LOW/NORMAL/HIGH/URGENT are textual. Creator/assignee/description/dates shown; self-created identity derived from creator=assignee.

Intentional card/list flow, stacked mobile fields and at least 44px mutation controls, with responsive desktop columns. Screens checked around 390px and desktop, no horizontal overflow. Existing Quicksand, shadcn Button/Input/Label/Card and light/dark/system themes retained. Browser screenshots of desktop Task list/detail and mobile list/create in light/dark were visually inspected; console/page error assertions passed on HEAD workflow. Authenticated agent-browser verification also passed desktop light list, dark detail and 390px mobile list/create, with no browser errors. Its isolated fixtures and private ignored browser state were removed. No future Calendar/Task progress/Drive/reporting UI.

## 16. Security Review

Reviewed service and command boundaries, canonical actor, explicit role/resource policies, active target reads, row/advisory lock order, creator immutability, strict Zod extras, current-assignee/deleted filtering, UUID/date interpretation, controlled 401/403/404/409, no-store responses, exact-origin POST/unchanged Better Auth CSRF, minimal joined DTOs, audit/notification payloads, client imports, fixture ownership/cleanup and Git/environment files.

Actual browser/server requests prove non-HEAD management denial, foreign Employee detail/API denial and no leaked content, completion payload/unknown-command rejection, hard-delete method rejection and foreign assignment denial. Library/database errors remain generic, with no credential-bearing logging. Security review found PostgreSQL-incompatible year 0000 accepted by ISO syntax; explicit refinement and offline/HTTP regression coverage correct this without schema changes. Candidate source/client-bundle and staged-content review passed with no locally configured credential values. Only .env.example is tracked; private environment/browser state, traces, runtime artifacts and fixture data are excluded.

## 17. Quality Gates

| Gate                        | Result                                                         |
| --------------------------- | -------------------------------------------------------------- |
| Formatting                  | PASS: format then format:check                                 |
| ESLint                      | PASS: zero warnings allowed, no rule suppression               |
| TypeScript                  | PASS: Next route types and tsc --noEmit                        |
| Unit/Task security          | PASS: 92/92                                                    |
| PostgreSQL integration      | PASS: 12/12, four files                                        |
| Production build            | PASS: Next.js 16.3.5                                           |
| Playwright E2E              | PASS: 12/12, desktop/mobile Chromium                           |
| Visual browser verification | PASS: authenticated agent-browser, screenshots, no errors      |
| Better Auth schema check    | PASS: raw/normalized artifacts match                           |
| Drizzle metadata/drift      | PASS: metadata and no schema changes, no second migration      |
| Live DB catalogs            | PASS: final nine tables, six enums, approved catalog structure |
| git diff --check            | PASS: final unstaged and staged checks                         |
| Secret/staged review        | PASS: credentials/artifacts excluded                           |

Authorized development database only: host ep-rough-water-b3k0vxik-pooler.c-4.ap-southeast-1.aws.neon.tech, database neondb; KIG_DATABASE_ENV=development. No connection string/secret printed. No production mutation, push workflow or schema/migration change. Final post-E2E cleanup verification found zero rows in each of all nine tables, one existing migration journal entry and zero non-internal public triggers.

Commands: baseline cwd/Git/runtime inspection and authoritative docs; npm run format, lint, typecheck, test, build, check, test:db, test:e2e, db:verify, db:generate; screenshot visual inspection; Git diff/check/secret/ignore review. npm run check covered format:check, lint, typecheck, test, build, Playwright discovery and db:check/auth:schema:check; npm ls --all reported zero dependency problems. Authenticated agent-browser and sanitized read-only cleanup counts also passed. npm.cmd is used on Windows. No package installation, migration application or production deployment required.

## 18. Documentation

Database and authorization technical docs updated in BOTH English/Vietnamese with equivalent Task architecture, policies, strict fields, lifecycle, immutable creator, transaction/locking, soft deletion, notices and tests. Business README/README-VN remain V1.1 unchanged; all prior approved detail preserved. Root developer README and CHANGELOG updated.

Inventory: Task policy/validation/types/service/HTTP/server/page wrappers and security tests; Task API and protected pages; TaskForm/TaskActions; shell Task link; PostgreSQL Task suite and enhanced namespace-owned fixture cleanup; Task E2E; bilingual technical additions, quick-start, changelog and this report.

## 19. Known Issues

- Global advisory coordination serializes Task writes; acceptable for the current internal foundation, future optimization must retain account-state/lifecycle guarantees.
- Existing upstream/tooling warnings retained: deprecated ESLint 9/esbuild-kit helpers; auth CLI transitive c12 4.0.0-rc.1; npm installation-script policy review documented in Phase 1. No dependencies changed.
- Playwright emits harmless NO_COLOR/FORCE_COLOR warning.
- Retained final-HEAD integration suites require an isolated development account baseline without permanent ACTIVE HEAD; never run against production/shared operational data. Permanent initial HEAD remains operator-supplied through controlled bootstrap.
- Initial-only migration wrapper must be separated from incremental migration tooling before a future migration; Phase 3 requires none. No Phase 4 work.

## 20. Git State

Branch main. Starting SHA above. Closure commit message: `feat: implement task core and lifecycle`. Ending commit is the commit containing this report, resolved with git rev-parse HEAD at closure and returned in the final response. No push. Stage only reviewed source/tests/configuration/documentation, exclude credentials/private .env/browser traces/runtime artifacts/fixture data. Final git status --short is empty after the closure commit; resolved commit SHA and clean evidence are returned in delivery. All 29 changed/added files are reviewed Phase 3 source, tests or documentation.

## 21. Phase 4 Readiness

Ready on the verified, committed clean Phase 3 baseline. Phase 4 — Daily Progress has not begun. Future completion must be an authorized current-assignee Daily Progress transaction with parent Task row locking, report/audit and business-date semantics; do not introduce a generic status mutation.
