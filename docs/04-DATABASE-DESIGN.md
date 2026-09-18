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
