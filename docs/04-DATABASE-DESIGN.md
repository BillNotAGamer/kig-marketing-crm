# Database Design — Version 1.1

**Status:** APPROVED. Design only; schema generation and migrations belong to Phase 1.

# 1. Architectural Principle

KIG Marketing CRM uses a full-stack Next.js monolith.

The database contains two logical domains:

```text
Authentication Domain
├── user
├── session
├── account
└── verification

Application Domain
├── task
├── task_daily_update
├── task_asset
├── notification
└── audit_log
```

Better Auth owns the authentication schema.

The application owns the CRM schema.

Better Auth's Drizzle schema must be generated from the actual authentication configuration using the Better Auth CLI instead of manually recreating its internal schema.

---

# 2. Identifier Strategy

All database entity identifiers use PostgreSQL native UUID where possible.

Better Auth must be configured with:

```ts
advanced: {
  database: {
    generateId: "uuid",
  },
}
```

Therefore:

```text
user.id                UUID
task.id                UUID
task_daily_update.id   UUID
task_asset.id          UUID
notification.id        UUID
audit_log.id           UUID
```

All application foreign keys referencing `user.id` therefore use UUID.

---

# 3. Authentication User State

Better Auth's `user.role` is the canonical user role.

Allowed application roles:

```text
HEAD
DEPUTY
EMPLOYEE
```

A user has exactly one KIG Marketing CRM role.

Multiple-role behavior supported internally by Better Auth must not be used by this application.

Business account status is derived from Better Auth:

```text
banned = false
→ ACTIVE

banned = true
→ INACTIVE
```

Do not add another application field such as:

```text
isActive
userStatus
deletedAt
```

to represent the same account state.

This avoids multiple conflicting sources of truth.

---

# 4. Better Auth Hardening

V1 uses email/password authentication.

Public registration is disabled.

Normal users may not:

- create accounts;
- hard-delete their account;
- edit identity fields through generic Better Auth user endpoints;
- reset their own password;
- change their own password unless they are HEAD.

HEAD uses the Better Auth Admin plugin for:

```text
Create user
Update user
Set role
Ban / unban user
Set user password
Read/list users
```

The following Better Auth Admin capabilities must NOT be granted in V1:

```text
delete user
impersonate user
impersonate admin
```

User hard deletion is not part of normal business behavior.

Generic user deletion endpoints must be disabled or blocked.

Generic user self-update must not bypass HEAD-only user management rules.

`change-password` must be protected by an auth hook so that only HEAD may use it.

HEAD resets another user's password through the administrative password-set operation.

---

# 5. User Role Rules

The application must enforce exactly one role.

Valid values:

```ts
type AppRole = "HEAD" | "DEPUTY" | "EMPLOYEE";
```

Any request attempting to store:

```text
HEAD,EMPLOYEE
HEAD,DEPUTY
unknown role
empty role
```

must be rejected.

The recommended default Better Auth role is:

```text
EMPLOYEE
```

The initial HEAD account is bootstrapped through a controlled administrative initialization process.

The user-management UI normally creates:

```text
DEPUTY
EMPLOYEE
```

HEAD promotion is an explicit role-change action rather than the normal account creation flow.

---

# 6. Final HEAD Invariant

At least one user must always satisfy:

```text
role = HEAD
AND
banned = false
```

The application must reject:

```text
disable final ACTIVE HEAD
demote final ACTIVE HEAD
```

This check must be protected against concurrent requests.

A simple:

```ts
countHeads();
updateUser();
```

without transactional/concurrency protection is insufficient.

---

# 7. PostgreSQL Enums

Application-owned enums:

```text
task_status
------------
OPEN
COMPLETED
CANCELLED
```

```text
task_priority
-------------
LOW
NORMAL
HIGH
URGENT
```

```text
task_progress_status
--------------------
COMPLETED
NOT_COMPLETED
```

```text
task_asset_provider
-------------------
GOOGLE_DRIVE
```

```text
task_asset_type
---------------
IMAGE
VIDEO
DOCUMENT
SPREADSHEET
PRESENTATION
PDF
OTHER
```

Notification types may use an application enum containing the supported notification events.

Audit actions remain application-controlled string constants because the audit vocabulary is expected to grow more frequently.

---

# 8. Table: task

```text
task
────────────────────────────────────────────

id                uuid PK

title             varchar(200) NOT NULL
description       text NULL

status            task_status NOT NULL
                  DEFAULT OPEN

priority          task_priority NOT NULL
                  DEFAULT NORMAL

assigned_date     date NOT NULL
due_date          date NULL

created_by_id     uuid NOT NULL
assigned_to_id    uuid NOT NULL

completed_at      timestamptz NULL
cancelled_at      timestamptz NULL

created_at        timestamptz NOT NULL
updated_at        timestamptz NOT NULL

deleted_at        timestamptz NULL
deleted_by_id     uuid NULL
```

Foreign keys:

```text
created_by_id
→ user.id
ON DELETE RESTRICT

assigned_to_id
→ user.id
ON DELETE RESTRICT

deleted_by_id
→ user.id
ON DELETE RESTRICT
```

`created_by_id` and `assigned_to_id` are semantically independent.

`created_by_id` is immutable under ordinary application behavior.

---

# 9. Task Constraints

Title must contain non-whitespace content.

Conceptually:

```sql
CHECK (length(trim(title)) > 0)
```

Deadline:

```sql
CHECK (
  due_date IS NULL
  OR due_date >= assigned_date
)
```

Completion:

```text
status = COMPLETED
→ completed_at IS NOT NULL
→ cancelled_at IS NULL
```

Cancellation:

```text
status = CANCELLED
→ cancelled_at IS NOT NULL
→ completed_at IS NULL
```

Open task:

```text
status = OPEN
→ completed_at IS NULL
→ cancelled_at IS NULL
```

Lifecycle fields must not be directly accepted from ordinary form payloads.

For example a client may not send:

```json
{
  "status": "COMPLETED",
  "completedAt": "..."
}
```

to a generic update endpoint.

Lifecycle transitions use dedicated services.

---

# 10. Task Creation

Server always determines:

```text
createdById = authenticated actor
status = OPEN
completedAt = NULL
cancelledAt = NULL
deletedAt = NULL
```

The client never supplies `createdById`.

HEAD may create a task for any eligible ACTIVE user, including HEAD.

DEPUTY may create:

```text
task for self

OR

task for ACTIVE EMPLOYEE
```

DEPUTY may not assign to HEAD.

EMPLOYEE may only create:

```text
assignedToId = own user ID
```

---

# 11. Task Update Commands

Do not implement one unrestricted:

```text
updateTask(anyPatch)
```

operation.

Use explicit commands:

```text
updateTaskMetadata()
reassignTask()
cancelTask()
softDeleteTask()
submitTaskProgress()
correctTaskProgress()
```

This prevents unrelated permissions from being mixed.

`updateTaskMetadata()` never accepts:

```text
createdById
status
completedAt
cancelledAt
deletedAt
deletedById
```

`reassignTask()` is HEAD-only and only valid for an OPEN, non-deleted task.

`cancelTask()` is HEAD-only and only valid for an OPEN, non-deleted task.

---

# 12. Table: task_daily_update

```text
task_daily_update
────────────────────────────────────────────

id                   uuid PK

task_id              uuid NOT NULL
user_id              uuid NOT NULL

report_date           date NOT NULL

status                task_progress_status NOT NULL
reason                text NULL

created_at            timestamptz NOT NULL

corrected_at          timestamptz NULL
corrected_by_id       uuid NULL
correction_reason     text NULL
```

Foreign keys:

```text
task_id
→ task.id
ON DELETE RESTRICT

user_id
→ user.id
ON DELETE RESTRICT

corrected_by_id
→ user.id
ON DELETE RESTRICT
```

Unique constraint:

```text
UNIQUE(task_id, report_date)
```

There can be only one official daily update for a task on a given business date.

---

# 13. Daily Update Rules

`report_date` is generated by the server using:

```text
Asia/Ho_Chi_Minh
```

Normal clients do not submit an arbitrary `report_date`.

If:

```text
status = NOT_COMPLETED
```

then:

```text
reason IS NOT NULL
trim(reason) != ""
```

If:

```text
status = COMPLETED
```

then:

```text
reason IS NULL
```

The user who creates the update must equal the task's current assignee.

---

# 14. Daily Update Immutability

EMPLOYEE and DEPUTY cannot:

```text
UPDATE task_daily_update
DELETE task_daily_update
```

after submission.

Normal progress records are immutable from the assignee's perspective.

HEAD may perform a controlled correction only when necessary.

A correction requires:

```text
correctedAt
correctedById
correctionReason
```

and must generate a full audit entry containing the previous and resulting data.

This is an exceptional administrative operation, not an ordinary edit.

There is still only one `task_daily_update` row for the relevant task/date.

---

# 15. Completing a Task

`submitTaskProgress(COMPLETED)` must run atomically:

```text
Validate session
Validate resource ownership
Validate task OPEN
Validate task not deleted

INSERT task_daily_update

UPDATE task
  status = COMPLETED
  completed_at = now()

INSERT audit_log

COMMIT
```

If any step fails:

```text
ROLLBACK
```

---

# 16. Reporting NOT_COMPLETED

Atomically:

```text
Validate reason
Validate assignee
Validate task OPEN
Validate task not deleted

INSERT task_daily_update
  status = NOT_COMPLETED

INSERT audit_log

COMMIT
```

The parent task remains:

```text
OPEN
```

---

# 17. Administrative Progress Correction

HEAD may correct an erroneous daily report.

Example:

```text
COMPLETED
→ NOT_COMPLETED
```

The transaction must:

```text
lock/load affected task + daily update

update task_daily_update through controlled correction

set correction metadata

if corrected to NOT_COMPLETED:
    task.status = OPEN
    task.completedAt = NULL

if corrected to COMPLETED:
    task.status = COMPLETED
    task.completedAt = current correction time

write beforeData and afterData to audit_log

COMMIT
```

`correctionReason` is mandatory.

---

# 18. Table: task_asset

```text
task_asset
────────────────────────────────────────────

id                    uuid PK

task_id               uuid NOT NULL
created_by_id          uuid NOT NULL

provider               task_asset_provider NOT NULL
provider_file_id       varchar(255) NOT NULL

source_url              text NOT NULL

file_name               varchar(512) NULL
mime_type               varchar(255) NULL
asset_type              task_asset_type NOT NULL

created_at              timestamptz NOT NULL

deleted_at              timestamptz NULL
deleted_by_id           uuid NULL
```

Foreign keys:

```text
task_id
→ task.id
ON DELETE RESTRICT

created_by_id
→ user.id
ON DELETE RESTRICT

deleted_by_id
→ user.id
ON DELETE RESTRICT
```

---

# 19. Task Asset Rules

V1 provider:

```text
GOOGLE_DRIVE
```

Backend must validate supported URLs.

Approved domains are limited to required Google Drive/Google Docs domains.

Arbitrary external iframe URLs are not accepted as task assets.

The backend extracts and stores:

```text
providerFileId
fileName
mimeType
assetType
```

where available.

Do not rely on storing an expiring Google thumbnail URL as permanent data.

---

# 20. Active Asset Uniqueness

The same active Google Drive file should not be attached twice to the same task.

Recommended partial unique index:

```text
(task_id, provider, provider_file_id)
WHERE deleted_at IS NULL
```

After an association has been soft-deleted, it may be added again later if required.

---

# 21. Removing Task Assets

Removing an asset from CRM means:

```text
task_asset.deleted_at = now()
task_asset.deleted_by_id = actor
```

It does NOT mean:

```text
delete Google Drive file
```

KIG Marketing CRM must never delete the source Google Drive object as part of the V1 remove-asset workflow.

---

# 22. Google Drive Preview Failure

Task availability must not depend on successful Drive preview.

If Google returns:

```text
permission denied
file removed
preview unavailable
network/API failure
```

the Task Detail page remains available.

UI provides a graceful fallback such as:

```text
Không thể hiển thị bản xem trước.
Mở trên Google Drive
```

CRM authorization and Google Drive authorization are separate concepts.

Being allowed to see a task inside CRM does not automatically grant Google Drive permissions.

---

# 23. Table: notification

```text
notification
────────────────────────────────────────────

id             uuid PK

user_id        uuid NOT NULL

type           notification_type NOT NULL

title          varchar(200) NOT NULL
message        text NOT NULL

entity_type    varchar(50) NULL
entity_id      varchar(255) NULL

read_at        timestamptz NULL
created_at     timestamptz NOT NULL
```

Foreign key:

```text
user_id
→ user.id
ON DELETE RESTRICT
```

V1 notification candidates:

```text
TASK_ASSIGNED
TASK_UPDATED
TASK_REASSIGNED
TASK_CANCELLED
```

Notifications are persisted.

WebSocket infrastructure is not required for V1.

---

# 24. Table: audit_log

```text
audit_log
────────────────────────────────────────────

id               uuid PK

actor_user_id    uuid NULL

action           varchar(100) NOT NULL

entity_type      varchar(50) NOT NULL
entity_id        varchar(255) NULL

before_data      jsonb NULL
after_data       jsonb NULL
metadata         jsonb NULL

request_id       varchar(100) NULL
ip_address       varchar(64) NULL
user_agent       text NULL

created_at       timestamptz NOT NULL
```

`actor_user_id` may be NULL only for legitimate system operations.

Normal user-generated audit entries must identify their actor.

Audit records are append-only from application perspective.

No normal repository/service operation may update or delete audit rows.

---

# 25. Audit Events

Minimum V1 vocabulary:

```text
LOGIN

CREATE_USER
UPDATE_USER
DISABLE_USER
ENABLE_USER
CHANGE_ROLE
RESET_PASSWORD
CHANGE_OWN_PASSWORD

CREATE_TASK
UPDATE_TASK
REASSIGN_TASK
CANCEL_TASK
DELETE_TASK

MARK_TASK_COMPLETED
MARK_TASK_NOT_COMPLETED
CORRECT_TASK_PROGRESS

ADD_TASK_ASSET
REMOVE_TASK_ASSET
```

---

# 26. Soft Delete Policy

Task:

```text
deletedAt != NULL
```

means operationally deleted.

Task Asset:

```text
deletedAt != NULL
```

means the CRM association is removed.

User deletion is represented through:

```text
banned = true
```

No ordinary application workflow performs:

```sql
DELETE FROM user;
DELETE FROM task;
DELETE FROM task_asset;
```

Foreign keys use restrictive deletion behavior to make accidental hard deletion difficult.

---

# 27. Recommended Indexes

Task:

```text
(assigned_to_id, assigned_date)
WHERE deleted_at IS NULL

(assigned_to_id, status)
WHERE deleted_at IS NULL

(status, assigned_date)
WHERE deleted_at IS NULL

(due_date)
WHERE deleted_at IS NULL

(created_by_id)
```

Daily update:

```text
UNIQUE(task_id, report_date)

(user_id, report_date)
```

Task Asset:

```text
(task_id)
WHERE deleted_at IS NULL

UNIQUE(task_id, provider, provider_file_id)
WHERE deleted_at IS NULL
```

Notification:

```text
(user_id, read_at, created_at)
```

Audit:

```text
(actor_user_id, created_at)

(entity_type, entity_id, created_at)
```

---

## Runtime and driver decision

Node 24 LTS; Railway Node.js service; Neon PostgreSQL through stable Drizzle and Postgres.js. Use connection-based transactions, not Neon HTTP single-query semantics. No Phase 0 database connection.

Business DATE values (assignedDate, dueDate, reportDate) represent local calendar dates in Asia/Ho_Chi_Minh. TIMESTAMPTZ values represent event instants. Never substitute UTC truncation for a business date. Application uniqueness UNIQUE(taskId, reportDate) maps to SQL UNIQUE(task_id, report_date).

[Authorization model](05-AUTHORIZATION-MODEL.md). [Vietnamese design](04-DATABASE-DESIGN-VN.md).

## Phase 1 implementation evidence - 2026-09-18 (V1.1 unchanged)

The consolidated schema is `src/db/schema/index.ts`. Auth models are `user`, `session`, `account`, `verification`; application models are `task`, `task_daily_update`, `task_asset`, `notification`, `audit_log`. All nine primary keys and all user/task foreign keys use PostgreSQL UUID. Application IDs default to `gen_random_uuid()`; Better Auth uses `advanced.database.generateId="uuid"`. All 13 foreign keys use ON DELETE RESTRICT, including auth account/session ownership. There are no cascade deletions.

PostgreSQL enums: `task_status` (OPEN, COMPLETED, CANCELLED), `task_priority` (LOW, NORMAL, HIGH, URGENT), `task_progress_status` (COMPLETED, NOT_COMPLETED), `task_asset_provider` (GOOGLE_DRIVE), `task_asset_type` (IMAGE, VIDEO, DOCUMENT, SPREADSHEET, PRESENTATION, PDF, OTHER), `notification_type` (TASK_ASSIGNED, TASK_UPDATED, TASK_REASSIGNED, TASK_CANCELLED). NOT_REPORTED remains derived.

Fourteen CHECK constraints enforce the single canonical user role; non-empty task title; task date ordering, lifecycle and deletion actor pairing; daily-update reason and correction metadata consistency; asset provider ID/source URL and deletion actor pairing; non-empty notification title/message; non-empty audit action/entity type. Daily uniqueness is `UNIQUE(task_id, report_date)`. User email and session token retain generated uniqueness. Asset uniqueness covers `(task_id, provider, provider_file_id) WHERE deleted_at IS NULL`, allowing reattachment after soft deletion.

The 14 explicit indexes comprise three generated auth lookup indexes and eleven application indexes: task assignee/date, assignee/status, status/date, due date (all active-only), creator; daily user/date; active task assets and active asset uniqueness; notification user/read/created; audit actor/created and entity type/ID/created. Six indexes are partial. Multiple user relationships have explicit, matched relation names. Inferred insert/select types are exported for all five application models.

Business assigned_date, due_date and report_date use DATE represented as strings; all event timestamps use TIMESTAMPTZ. Business interpretation remains Asia/Ho_Chi_Minh. Daily reports are immutable to ordinary users and audit rows logically append-only; service enforcement belongs to later phases. No generic update/delete repositories are introduced.

Run `npm run auth:schema` using stable `auth@1.7.5` CLI. It reads shared schema-affecting `src/lib/auth/options.ts` through `scripts/auth-schema.config.mts`. Raw CLI output is preserved in `auth.generated.ts`; deterministic normalization creates `auth.ts` with TIMESTAMPTZ and the canonical-role CHECK. Required role/ban defaults and restrictive auth FKs originate in shared plugin metadata. Raw output is excluded from the consolidated migration schema. `npm run auth:schema:check` regenerates and compares both artifacts. The offline CLI uses an ephemeral random tooling secret, opens no database, and warns about the intentionally absent base URL; runtime validates actual server credentials.

Postgres.js provides transactional connections for Railway + Neon. The server-only lazy DB singleton reuses its development hot-reload connection; Better Auth uses the PostgreSQL Drizzle adapter with transactions enabled. No UI imports the DB.

Workflow: regenerate auth, review diff, `npm run db:generate`, review SQL, then `npm run db:migrate` only against an explicitly authorized empty development database. Initial migration: `drizzle/0000_initial_v1_1.sql` with version-controlled snapshots/journal; SQL is generated, not manually patched. `db:migrate`, `db:verify`, `db:studio`, and `test:db` require `KIG_DATABASE_ENV=development` and a private development DATABASE_URL. Migration preflight refuses existing public tables/enums or an existing Drizzle journal; never delete existing data to bypass it. Production-looking identifiers are rejected, but operators must still verify target identity. Studio is development-only. Never use push as the authoritative workflow.

`npm run db:check` validates migration metadata and auth regeneration offline. `npm run db:verify` inspects live catalogs. `npm run test:db` checks PostgreSQL constraints with transactional fixtures that are rolled back, without provisioning credentials or seeding permanent data. The initial offline run had no authorized development database. Closure subsequently applied the unchanged initial migration to authorized development PostgreSQL; live catalogs and transactional integration checks passed with no remaining fixture rows. No production database, initial HEAD, auth HTTP route, or Phase 2 service was created.

## Phase 2 persistence use - 2026-09-18

Phase 2 uses the existing nine-table V1.1 schema without migration changes. The applied initial SQL, snapshot and journal remain immutable. Auth-generated artifacts remain deterministic; no incremental migration is required. The initial-only migration wrapper stays unchanged; before any future incremental migration, separate initialized-database migration validation from initial empty-schema validation. Never clear the database or rewrite the applied initial migration.

User administration and successful login bind Better Auth's PostgreSQL Drizzle adapter to the caller's transaction, including audit writes. Advisory transaction lock 24091802 serializes bootstrap, login and all application user mutations before fresh canonical user checks. Disable uses Better Auth banned state without expiry and revokes sessions. Role/email/password changes revoke affected sessions. Daily/task/asset schema and DATE/TIMESTAMPTZ semantics remain unchanged. Audit writes are append-only in the application; controlled fixture cleanup is test-only. See the bilingual authorization Phase 2 section for the complete auth/permission/password/bootstrap and atomicity contract.

## Phase 3 Task persistence - 2026-09-18 (V1.1 unchanged)

`src/lib/tasks/service.ts` owns explicit create/read/list/metadata/reassign/cancel/soft-delete operations using the existing task, notification and audit_log tables. No schema, enum, applied migration, generated auth artifact or migration journal changes. Incremental migration tooling remains a prerequisite only when a future migration is genuinely required.

All Task mutations run in one Postgres.js/Drizzle transaction: acquire the existing exclusive account-administration advisory transaction lock 24091802, derive the canonical actor, authorize, lock existing task rows FOR UPDATE, re-read eligibility/lifecycle, mutate and insert audit/required notification before commit. Reads acquire the shared variant of the same advisory lock before canonical session checks and role-scoped joins. This coordinates assignments with Phase 2 role/deactivation changes and prevents stale authenticated actors or inactive targets from winning against an already-committed administrative change. Lock order is account advisory lock, then task row; READ COMMITTED reads fresh committed state after waiting. Writes are intentionally serialized across tasks in this initial internal foundation; optimize only with equivalent account-state and lifecycle guarantees.

Task list/detail join creator and assignee once with explicit minimal user projections (ID/name), preventing N+1 reads and credential fields in Task DTOs. Every normal task query filters deleted_at IS NULL; EMPLOYEE also filters current assigned_to_id=actor.id. Creator is never used to extend Employee access. DATE strings roundtrip unchanged; current default date comes from Asia/Ho_Chi_Minh, not UTC truncation. Event timestamps use existing TIMESTAMPTZ columns.

Metadata/reassign/cancel require OPEN and non-deleted rows. Cancellation sets CANCELLED/cancelled_at and clears completed_at, retaining business history. Soft deletion supports any lifecycle state, sets paired deleted_at/deleted_by_id, preserves lifecycle/creator and retains daily/asset/audit rows. No normal DELETE SQL, restore or completion command. Phase 4 will exclusively introduce completion through Daily Progress.

Audit events: CREATE_TASK, UPDATE_TASK, REASSIGN_TASK, CANCEL_TASK, DELETE_TASK. Whitelisted business snapshots include ownership, metadata, dates, status and lifecycle/delete evidence; no unrelated user/account/session data. Notifications persist TASK_ASSIGNED for another-user creation, TASK_UPDATED for another-user metadata edit, TASK_REASSIGNED for the new assignee (including reassignment to the acting HEAD), TASK_CANCELLED for another-user cancellation. No deletion notification type or notification-center UI. Notification payloads are task title/entity ID plus recipient/type; task access must always be re-authorized when a future notification is opened.

Real PostgreSQL tests cover role-scoped reads, creator retention/access transfer, lifecycle/soft deletion, date types, notices/audits and competing cancel/reassign/delete/edit transactions. Transaction-local failure triggers deliberately reject audit or notification inserts and prove rollback of task creation/reassignment and associated records. Trigger DDL and temporary functions are rolled back/connection-scoped test instrumentation, never a migration or persistent schema change. Historical completed/daily/asset fixtures exist only to prove safe rendering/deletion retention, not to implement their workflows. Namespace-owned fixture cleanup removes test dependencies before tasks/users; production services never do this.

ISO input validation additionally rejects year 0000, which PostgreSQL DATE does not support; invalid dates fail validation rather than becoming database errors. This technical guard preserves normal business DATE semantics.

## Phase 4 Daily Progress persistence - 2026-09-18

`src/lib/progress/service.ts` implements explicit submitTaskProgress/getTaskProgressHistory/getTodayTaskProgress/correctTaskProgress and a consistent history/today/control view. It uses the existing schema; no migration/notification enum changes. Clock injection is server-owned test dependency only. After advisory coordination, canonical actor and Task FOR UPDATE checks, server derives reportDate from the current instant via Asia/Ho_Chi_Minh. DATE strings are not converted to UTC; event fields retain TIMESTAMPTZ.

Normal submission is current-assignee/OPEN/non-deleted only, irrespective of role. Strict discriminated schemas accept COMPLETED without any reason key or NOT_COMPLETED with trimmed nonblank reason (max 5,000 characters). Client dates/actors/correction/lifecycle fields fail. Under the same lock, check task/date absence before insert; PostgreSQL UNIQUE(task_id,report_date) remains the final guard. COMPLETED inserts history, updates parent status/completedAt/cancelledAt and writes MARK_TASK_COMPLETED in one transaction. NOT_COMPLETED writes history/MARK_TASK_NOT_COMPLETED and leaves parent OPEN/timestamps unchanged. NOT_REPORTED is derived from absence, never persisted. Reassignment preserves original history; an existing same-day report also blocks a new assignee until a later business date.

Only HEAD correction changes an existing latest report (reportDate DESC, UUID tie-break). Lock order: exclusive advisory 24091802, Task row, latest report row. Require changed status, bounded nonblank correctionReason and incomplete reason when applicable; reject older/missing, same-status, deleted or CANCELLED cases and mismatched parent/report lifecycle. Preserve original report ID/date/user/createdAt. Set all correction metadata together. COMPLETED→NOT_COMPLETED reopens parent OPEN/completedAt null; the reverse completes at correction time/cancelledAt null. Full before/after CORRECT_TASK_PROGRESS audit shares commit. Repeated meaningful corrections retain every version in append-only audits, while the official report remains a single row.

Reads share advisory coordination and inherit current-assignee/team/non-deleted Task policy before querying progress. Explicit safe DTOs exclude auth/session and internal reporter/correction actor IDs. PostgreSQL suites prove UTC boundary DATE roundtrip, multi-day/same-day reassignment, authorization, uniqueness, concurrent double reports and both commit orders of completion versus cancel/reassign. Transaction-local failure triggers prove audit/task failure rollback for reporting/correction; DDL and fixture data are cleaned. No generic history update/delete/status/reopen path or progress notification persistence.

## Phase 5 Google Drive Task Assets persistence - 2026-09-19

Phase 5 implements Google Drive Task Asset / Deliverable management using the existing `task_asset` table and PostgreSQL enums `task_asset_provider` (GOOGLE_DRIVE) and `task_asset_type` (IMAGE, VIDEO, DOCUMENT, SPREADSHEET, PRESENTATION, PDF, OTHER). No database schema migration or drift is required. The initial applied migration `drizzle/0000_initial_v1_1.sql` and journal remain unchanged.

External metadata retrieval from Google Drive API occurs outside any PostgreSQL transaction. Network reads do not hold database connections or locks. Once metadata is fetched, the transaction boundary begins: acquire exclusive advisory transaction lock 24091802, derive canonical actor, re-read and lock Task FOR UPDATE, revalidate state (HEAD attaches to any non-deleted task; DEPUTY/EMPLOYEE attach only to own assigned OPEN non-deleted task), verify absence of active duplicate file, insert `task_asset`, and insert `ADD_TASK_ASSET` audit row before commit. If metadata insertion or audit fails, the transaction rolls back completely; the external Drive file is never mutated.

Active duplicate protection is enforced at the database level by the existing partial unique index `task_asset_active_file_unique` on `(task_id, provider, provider_file_id) WHERE deleted_at IS NULL`. The service checks for active duplicates under lock and returns controlled 409 Conflict. Once an asset is soft-deleted, reattaching the same file is permitted.

Soft removal sets `deleted_at = now()` and `deleted_by_id = actor.id` and appends a `REMOVE_TASK_ASSET` audit row in the same transaction. The row is never hard-deleted from `task_asset`. No Google Drive delete or trash API call is ever made; Drive remains completely read-only to KIG CRM.

Safe DTO projection exposes only necessary business attributes (`id`, `fileName`, `assetType`, `provider`, `sourceUrl`, `openUrl`, `previewUrl`, `canRemove`, `createdAt`, `createdByName`). Previews are constructed exclusively using trusted Google domains (`drive.google.com`, `docs.google.com`). Real PostgreSQL integration tests verify active duplicate rejection, cross-user isolation, soft-deletion reattachment, audit atomicity, and injected failure rollbacks. All test fixtures clean up test-created data leaving zero lingering rows.

## Phase 6 Calendar & Mobile Task Experience persistence - 2026-09-19 (V1.1 unchanged)

Phase 6 is a presentation and query phase over existing Task and Daily Progress data. It requires zero database schema migrations, zero new tables, and zero enum changes. The initial migration `drizzle/0000_initial_v1_1.sql` and migration journal remain identical to Phase 1.

Calendar semantics are derived purely from existing `task.assigned_date` and `task.due_date` columns:

- `assignedDate` maps to an ASSIGNED / START marker ("Giao").
- `dueDate` maps to a DEADLINE marker ("Hạn").
- If `assignedDate === dueDate`, the task produces a single combined marker ("Giao & Hạn") rather than duplicate markers.
- No synthetic duration markers are generated for intermediate dates between `assignedDate` and `dueDate`.
- Soft-deleted tasks (`deleted_at IS NOT NULL`) are strictly excluded from all calendar queries and date views.
- Non-deleted tasks across all lifecycle states (`OPEN`, `COMPLETED`, `CANCELLED`) remain visible with appropriate visual affordances.

Date queries are strictly bounded to at most 62 calendar days via `listCalendarTasks()` service. The query applies date filtering at the PostgreSQL level: `(assigned_date BETWEEN from AND to) OR (due_date BETWEEN from AND to)` under existing indexes. When the query range includes current business today (`Asia/Ho_Chi_Minh`), today's official daily progress status is batch-joined via `task_daily_update` without N+1 queries. No external Google Drive API calls are invoked from Calendar services.

## Phase 7 Dashboard, Reports, Search, Notifications & Audit persistence - 2026-09-19 (V1.1 unchanged)

Phase 7 implements read-oriented Dashboard, Historical Reports, Task Search, Notification Center, and Audit Log viewing over existing baseline data. It requires zero database schema migrations, zero new tables, zero index additions, and zero enum changes. The initial migration `drizzle/0000_initial_v1_1.sql` remains identical to Phase 1, maintaining the strict 9-table, 6-enum schema baseline.

### 1. Operational Today Dashboard

- Today's operational task set is server-derived for `Asia/Ho_Chi_Minh`: unique non-deleted tasks where `assigned_date <= businessToday` AND (`status = 'OPEN'` OR task has an official `task_daily_update` on `businessToday`).
- Tasks completed before today with no report today do not inflate operational metrics.
- Same-day reassignment attribution: if a report exists today, COMPLETED / NOT_COMPLETED is attributed to `report.userId`; if no report exists, NOT_REPORTED is attributed to current `task.assignedToId`. No duplicate NOT_REPORTED is credited to a newly reassigned employee when a report was already submitted.
- Overdue count is derived dynamically (`status = 'OPEN' AND due_date IS NOT NULL AND due_date < businessToday`). Never persisted.

### 2. Historical Operational Reports

- Persisted facts only over strict ISO date ranges (max 366 days, default 30 days ending `businessToday`).
- Persisted metrics: submitted progress reports count, completed count, not-completed count, completion ratio among submitted reports (`completed / submitted * 100`), tasks completed in range, tasks assigned in range, and current overdue count.
- Zero fabricated historical NOT_REPORTED metrics. Historical unassigned or unrecorded operational states are never simulated.
- Per-reporter breakdown groups by actual `task_daily_update.userId`, preserving representation for historical or inactive users.

### 3. Task Search

- Substring search on `task.title` and `task.description` (plus assignee display name for team roles) using parameterized Drizzle queries.
- Escapes SQL wildcard characters `%` and `_` to guarantee literal substring semantics.
- Bounded pagination (default 20, max 50) with deterministic ordering (`updated_at DESC, id DESC`).

### 4. Notification Center & Read State

- Uses committed `notification` table with existing `read_at: timestamp with time zone NULL` and composite index `notification_user_read_created_idx (user_id, read_at, created_at)`.
- Recipient-isolated: queries strictly filter `user_id = actor.id`. Atomic `markNotificationRead` and `markAllNotificationsRead` execute via `.returning({ id: notification.id })`.
- Preserves safe historical notification snapshots without exposing current task data when recipient no longer has task read access.

### 5. Audit Log Viewer

- Read-only queries against existing `audit_log` table restricted strictly to HEAD.
- Sanitized projection strips sensitive authentication, token, credential, and password fields. Bounded pagination (default 25, max 50).
- Zero Google Drive API calls are invoked from Dashboard, Reports, Search, Notifications, or Audit services.

# Phase 8 operational safety

The schema remains nine tables/six enums with no Phase 8 migration. `/api/health` performs only parameterized `SELECT 1` and returns no database identity. Development bootstrap is distinct from incremental migration; all fixture and database tooling retains the explicit environment/target guard.
