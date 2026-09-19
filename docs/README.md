# KIG MARKETING CRM

## Business Specification — Version 1.1

**Project:** KIG Marketing CRM
**Workspace:** `F:\Coding\Web development\KIG Marketing CRM`
**Status:** APPROVED BASELINE — V1.1

Phase 8 security hardening preserves V1.1. Production configuration, Drive folder isolation, readiness, backup and credential procedures are maintained in `06-PRODUCTION-READINESS.md`; they do not change approved roles or workflows.
**Primary stakeholder specification:** [Vietnamese](README-VN.md)

This English specification is optimized for engineering agents. Sections 1–31 and the V1.1 additions correspond to the Vietnamese business baseline. The original approved English technical baseline is retained in full below as an appendix; the dedicated database and authorization documents organize that detail.

## 1. System goals

Internal daily Marketing task management for KIG Holding. HEAD and DEPUTY assign work; employees track assigned tasks by date and report completion or non-completion with a required reason. HEAD monitors team progress. Preserve task/change history and strongly optimize mobile UX. Calendar is the central task interface. This is not a sales CRM and has no public registration.

## 2. Technical foundation

Next.js full-stack monolith, React, TypeScript, PostgreSQL, Neon, stable Drizzle ORM, Better Auth, Zod, React Hook Form, Tailwind CSS, shadcn/ui, next-themes, Lucide, Railway, and Git/GitHub. Business timezone: `Asia/Ho_Chi_Minh`. Primary font: `Quicksand, sans-serif`. Runtime: Node 24 LTS. Railway production uses transactional Postgres.js; no Phase 0 database initialization.

## 3. HEAD

HEAD is the application's administrator. HEAD manages all users: create/update accounts, change roles, activate/deactivate, reset user passwords, and change HEAD's own password. HEAD views all tasks, creates/assigns/edits/reassigns/cancels/soft-deletes tasks, reads all reports and audit logs, and monitors the entire team.

## 4. DEPUTY

DEPUTY manages work but is not an administrator. DEPUTY reads team tasks, team dashboards and reports, creates tasks for self or ACTIVE EMPLOYEE, and reports progress on tasks assigned to self. DEPUTY cannot manage users, deactivate/delete users, change roles, reset any password or change own password, edit existing task metadata, delete/reassign tasks, or edit another user's progress. DEPUTY cannot assign to HEAD or another DEPUTY. Allowing edits to tasks DEPUTY created would require an explicit business and documentation change.

## 5. EMPLOYEE

EMPLOYEE reads assigned/self-created tasks, creates tasks for self, reports own progress, marks completion/non-completion with a reason, and reads personal history. EMPLOYEE cannot view another employee's private tasks, assign to others, edit existing task metadata, delete/reassign tasks, manage users/roles/passwords, or change another user's progress. A self-created task remains identifiable from creator/assignee equality.

## 6. Permission matrix

| Action                                                                    | HEAD         | DEPUTY               | EMPLOYEE |
| ------------------------------------------------------------------------- | ------------ | -------------------- | -------- |
| Sign in                                                                   | Yes          | Yes                  | Yes      |
| Public registration                                                       | No           | No                   | No       |
| Read own tasks                                                            | Yes          | Yes                  | Yes      |
| Read team tasks                                                           | Yes          | Yes                  | No       |
| Create own task                                                           | Yes          | Yes                  | Yes      |
| Assign to others                                                          | ACTIVE users | ACTIVE EMPLOYEE only | No       |
| Edit/reassign/cancel/soft-delete tasks                                    | Yes          | No                   | No       |
| Report own COMPLETED/NOT_COMPLETED with required reason for NOT_COMPLETED | Yes          | Yes                  | Yes      |
| Ordinary progress changes on behalf of others                             | No           | No                   | No       |
| Read team dashboard/reports                                               | Yes          | Yes                  | No       |
| Read personal dashboard                                                   | Yes          | Yes                  | Yes      |
| Create/update/disable users, change roles, reset passwords                | Yes          | No                   | No       |
| Change own password                                                       | Yes          | No                   | No       |
| Read system audit log                                                     | Yes          | No                   | No       |

HEAD's audited administrative progress correction is a separate exceptional permission; it does not grant ordinary progress submission as another assignee.

## 7. Account management

No Sign Up/public registration. HEAD creates accounts, supplies identity/role/password, and the user signs in. DEPUTY and EMPLOYEE cannot change their own passwords; they contact HEAD for reset. Initial HEAD is created through controlled administrative initialization. Normal account creation creates DEPUTY/EMPLOYEE; HEAD promotion is explicit.

## 8. Account removal

Never hard-delete users in ordinary operation. UI employee removal means deactivation. ACTIVE means Better Auth `banned=false`; INACTIVE means `banned=true`; no duplicate account-state field. INACTIVE users cannot sign in/receive new tasks and are excluded from default assignee lists. Preserve historical tasks, daily updates, audit logs, and historical reporting accuracy. Always retain at least one ACTIVE HEAD; reject disabling/demoting the last ACTIVE HEAD even under concurrent requests.

## 9. Task model

Minimum business fields: ID, title, description, creator, assignee, assigned date, optional due date, priority/status, created/updated/completed timestamps, and optional soft-delete timestamp. `createdById` and `assignedToId` are independent. HEAD editing employee A's task never changes creator A.

## 10. Priority

LOW, NORMAL, HIGH, URGENT. Default NORMAL.

## 11. Lifecycle

OPEN means work remains; COMPLETED means finished; CANCELLED means HEAD cancelled the requirement. Normal transitions: OPEN → COMPLETED or OPEN → CANCELLED. No automatic completion or cancellation. Lifecycle commands own timestamps and status; generic metadata payloads cannot set them.

## 12. Daily Progress

Task lifecycle and daily reporting are distinct. Stored progress statuses: COMPLETED and NOT_COMPLETED. NOT_REPORTED is inferred when no report exists for the relevant date; it need not be a persisted record. One official update per task/business date: `UNIQUE(taskId, reportDate)`.

## 13. Completion

Only the current assignee reports ordinary progress on an OPEN, non-deleted task. Completion creates a COMPLETED daily update, changes the task to COMPLETED, sets completedAt, and records audit atomically. EMPLOYEE/DEPUTY cannot edit completed task content or reopen it. Mistakes require HEAD intervention.

## 14. Non-completion

A non-empty, non-whitespace reason is mandatory (for example, awaiting Media footage). Create a NOT_COMPLETED daily update, preserve the reason, keep the task OPEN, and audit atomically. It remains on unfinished-work lists.

## 15. Multi-day tasks

No automatic cloning. A task assigned on 18 September and reported NOT_COMPLETED retains its ID/OPEN state. On 19 September it remains unfinished/overdue and may receive a new daily report, for example COMPLETED. One task has multiple dated progress records.

## 16. Self-created tasks

For EMPLOYEE, creator and assignee are the authenticated user. No alternate assignee selection. EMPLOYEE cannot edit content after creation; HEAD retains administrative rights. UI identifies self-created work from `createdById === assignedToId`, or future appropriate metadata if explicitly needed.

## 17. Assignment

HEAD assigns to any ACTIVE user, including self, and may reassign. DEPUTY creates for self or ACTIVE EMPLOYEE, cannot assign to HEAD, and cannot change the assignee after creation. EMPLOYEE creates for self only. HEAD reassigns only OPEN/non-deleted tasks to ACTIVE assignees.

## 18. Editing

HEAD edits title, description, assigned date, due date, priority, assignee through dedicated reassignment, and appropriate administrative metadata. Never change `createdById` through ordinary editing; only a controlled technical migration/recovery could repair original data. DEPUTY/EMPLOYEE cannot edit existing task content.

## 19. Task deletion

HEAD-only soft deletion (`deletedAt != null`). Exclude from default working views/current statistics; retain audit history. Future restoration is possible only if implemented. No normal hard deletion.

## 20. Cancellation versus deletion

Cancellation is a business state, for example an event is cancelled so its banner is unnecessary. The task remains visible in history. Deletion administratively removes it from ordinary operation. These are distinct operations.

## 21. Audit

Mandatory from V1: LOGIN, CREATE_USER, UPDATE_USER, DISABLE_USER, CHANGE_ROLE, RESET_PASSWORD, CREATE_TASK, UPDATE_TASK, REASSIGN_TASK, CANCEL_TASK, DELETE_TASK, MARK_TASK_COMPLETED, MARK_TASK_NOT_COMPLETED, plus V1.1 asset/correction events and other approved technical events. Record actor/action/entity/time and relevant before/after data. Application audit records are append-only.

## 22. Calendar

Central task interface. Desktop prioritizes month/week/daily detail. Mobile prioritizes date selector, daily agenda, task cards, and bottom navigation. Do not merely shrink desktop calendar onto mobile.

## 23. Dashboard

HEAD may see today's total/completed/incomplete/not-reported counts, completion rate, employee progress, and overdue tasks. DEPUTY reads team dashboard without user-administration permission. EMPLOYEE focuses on today's own work, completion/report counts and personal overdue tasks.

## 24. Theme and mobile

Light, Dark, System; mandatory mobile-first design. Check principal screens on mobile/tablet/desktop. A smaller desktop layout alone is insufficient mobile UX.

## 25. Notifications

Prioritize in-app notifications, for example a new banner assignment. Email, Telegram, Zalo, and push integrations are not required V1 scope. Persist notifications; WebSockets are not required.

## 26. Invariants

INV-01: creator never changes during task edits. INV-02: only HEAD manages users. INV-03: DEPUTY/EMPLOYEE cannot change own passwords. INV-04: EMPLOYEE cannot assign to others. INV-05: NOT_COMPLETED requires reason. INV-06: only assignee submits ordinary progress. INV-07: EMPLOYEE/DEPUTY cannot reopen COMPLETED tasks. INV-08: INACTIVE cannot sign in/receive work. INV-09: final ACTIVE HEAD cannot be disabled/demoted. INV-10: tasks use soft deletion and users deactivation. INV-11: backend enforces permissions; hidden controls are insufficient. INV-12: business timezone is `Asia/Ho_Chi_Minh`.

## 27. Source of truth

Vietnamese business documentation in `docs/` is the primary official source. Code alone is not the specification. If code and docs conflict, report the discrepancy, verify the rule, then update documentation, implementation and tests together. Do not leave an undocumented deliberate disagreement.

## 28. Documentation changes

Changes to roles, permissions, lifecycle, progress, users, authentication, passwords, ownership, audits, business-significant database relationships, workflows, or UI/reporting semantics require updates to BOTH language versions and tests. Code alone does not complete a business change.

## 29. Change log

Record important business changes in CHANGELOG with date/version/change/reason/impact/related docs/migrations/tests. A hypothetical future DEPUTY edit permission would affect the matrix, task-update policy, RBAC tests, API authorization and UI; it is not approved behavior today.

## 30. V1 scope

Authentication/RBAC; HEAD/DEPUTY/EMPLOYEE; user management; tasks/self-created work; daily COMPLETED/NOT_COMPLETED/inferred NOT_REPORTED and required reasons; calendar/dashboard; audit; basic in-app notifications/search/filter; light/dark/system themes; mobile-first; task soft deletion/user deactivation; Google Drive assets/deliverables and safe preview.

Out of scope: AI, sales/customer CRM, multi-tenancy, microservices, real-time collaborative editing, Redis/Kafka, external email automation, Zalo/Telegram, and advanced campaign analytics. These describe future V1 scope, not implemented Phase 0 features.

## 31. Approved decision

**APPROVED BASELINE — Version 1.1**. Preserve the established V1.0 requirements; V1.1 adds assets and formalizes the approved technical safeguards. All later database/API/UI/tests follow this baseline.

## V1.1 — Google Drive assets and technical safeguards

Assets/deliverables are resources separate from task metadata. V1 provider is `GOOGLE_DRIVE`. Validate/normalize supported Google Drive/Docs domains server-side; never embed arbitrary URLs. Store stable provider file ID/source URL and available filename/MIME/type metadata; never rely on permanent expiring thumbnail URLs. Types: IMAGE, VIDEO, DOCUMENT, SPREADSHEET, PRESENTATION, PDF, OTHER. Prevent duplicate active file associations per task; soft-removed associations can be re-added.

HEAD attaches to any non-deleted task and removes any active association. DEPUTY/EMPLOYEE attach only to their own current OPEN, non-deleted task. They remove only associations they created on their own current OPEN, non-deleted task. Creating a task for an employee does not give DEPUTY ownership of that employee's deliverables. Reads follow task visibility and exclude removed assets.

Preview supports approved Drive content with a graceful unavailable/permission/network fallback and an Open in Google Drive option. Task Detail must remain available. CRM authorization does not grant Drive permission. Removing an association only soft-deletes CRM metadata and audits it; never delete or modify the Drive source file. Credentials/API/preview implementation belong to the integration phase.

Daily progress is immutable to ordinary users after submission. HEAD correction requires separate authorization, correction time/actor/reason and full before/after audit. Correction adjusts the parent lifecycle atomically; one row per task/date remains. Server derives reportDate in the business timezone. DATE represents calendar dates; TIMESTAMPTZ represents event instants.

INV-13: assets are independent of task metadata/ownership. INV-14: ordinary users attach only to own OPEN work. INV-15: only approved validated providers are previewed (Drive in V1). INV-16: preview failure never blocks the task. INV-17: removal never modifies/deletes source content. INV-18: at most one official daily report/task/business date. INV-19: ordinary reports immutable, HEAD corrections separate/audited. INV-20: UUID identifiers/user foreign keys with Better Auth PostgreSQL UUID configuration.

### Daily Progress implementation safeguards (Phase 4, V1.1)

One official report belongs to the Task/date, not the assignee/date. Reassignment after today's report preserves its original reporter/history; the new assignee waits until a later business date for another ordinary report. HEAD may correct only the latest official report, changing COMPLETED ↔ NOT_COMPLETED with mandatory administrative reason and incomplete reason when applicable. Same-status/text-only corrections are rejected. Correction preserves original report date/reporter/creation time and audits every before/after; correcting COMPLETED to NOT_COMPLETED is the only reopening path. Correction never undoes cancellation and is unavailable for soft-deleted tasks. These chronology/lifecycle safeguards implement the separately authorized correction exception without changing Version 1.1.

### Calendar & Mobile Task Experience implementation safeguards (Phase 6, V1.1)

Calendar is a read-oriented presentation and query layer over existing Task and Daily Progress data. It introduces zero database migrations, zero new tables, and zero schema changes. Calendar markers derive directly from `assignedDate` (ASSIGNED / START marker "Giao") and `dueDate` (DEADLINE marker "Hạn"). When `assignedDate === dueDate`, markers deduplicate into a single combined marker ("Giao & Hạn"). No synthetic duration markers are generated for days between assignment and deadline. All calendar calculations use zero-timezone-shift date arithmetic, Monday-first week layouts, and `Asia/Ho_Chi_Minh` for the current business date. Calendar visibility strictly inherits Task resource authorization: HEAD and DEPUTY read team tasks, EMPLOYEE reads own assigned tasks, and soft-deleted tasks are excluded. The mobile view provides an agenda-first layout (~390px) with a 7-day compact week strip, persistent bottom navigation, and an Employee Today operational hub without horizontal overflow. No Google Drive API calls are executed by Calendar services.

### Dashboard, Reports, Search, Notifications & Audit implementation safeguards (Phase 7, V1.1)

Phase 7 introduces operational dashboards, historical reporting, task search, notification center, and an audit log viewer strictly over existing baseline schema without migrations, new tables, or enum modifications:

- Operational Today Dashboard derives metrics dynamically in `Asia/Ho_Chi_Minh` for unique non-deleted tasks assigned on or before today that are either OPEN or reported today via `task_daily_update`. Same-day reassignment credits submitted reports to `report.userId` and unreported tasks to current `task.assignedToId` without false non-reporting counts for reassigned users.
- Overdue tasks are computed dynamically from `status === 'OPEN' && dueDate !== null && dueDate < businessToday`. OVERDUE is never persisted as a status.
- Historical Operational Reports reflect strictly persisted evidence over bounded date ranges (up to 366 days). Arbitrary historical `NOT_REPORTED` metrics are never fabricated. Per-reporter breakdown groups by actual `task_daily_update.userId`.
- Task Search supports literal substring queries with `%` and `_` escaped, bounded pagination (max 50), and strict role scoping (EMPLOYEE never discovers foreign tasks).
- Notification Center isolates notifications strictly to the recipient (`user_id === actor.id`), supports atomic mark single/all as read via the existing `notification.read_at` column, and never uses historical notifications to leak fresh task permissions.
- Audit Log Viewer is restricted strictly to HEAD (DEPUTY/EMPLOYEE receive 403), read-only, append-only, and strips all credential/secret material.
- Zero Google Drive calls are made from Dashboard, Reports, Search, Notifications, or Audit services.

See [database design](04-DATABASE-DESIGN.md), [authorization](05-AUTHORIZATION-MODEL.md), and [changelog](CHANGELOG.md).

---

# Preserved approved technical baseline (original English document)

# KIG MARKETING CRM

## Database Schema & Authorization Model — Technical Baseline V1.1

**Status:** APPROVED
**Business baseline:** V1.1
**Database:** PostgreSQL / Neon
**ORM:** Drizzle ORM
**Authentication:** Better Auth
**Business timezone:** `Asia/Ho_Chi_Minh`

---

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

# 28. Authorization Architecture

Authorization uses:

```text
Authentication
+
RBAC
+
Resource Ownership
+
Contextual Business Policy
```

RBAC alone is insufficient.

Authorization sequence:

```text
Request
   ↓
Authenticated?
   ↓
Role permits action?
   ↓
Resource policy permits actor?
   ↓
Lifecycle/business transition valid?
   ↓
Execute transaction
```

---

# 29. Application Permissions

Canonical permission vocabulary:

```text
user:create
user:read
user:update
user:disable
user:enable
user:change-role
user:reset-password

task:create-self
task:create-for-others
task:read-self
task:read-team
task:update
task:reassign
task:cancel
task:delete

progress:create-own
progress:correct

asset:create-own
asset:create-any
asset:read-own
asset:read-team
asset:delete-own
asset:delete-any

report:read-self
report:read-team

audit:read
```

No wildcard permission such as:

```text
"*"
```

is used in production permission definitions.

HEAD permissions are explicitly enumerated.

---

# 30. Task Authorization

## View task

HEAD:

```text
all non-deleted tasks
```

DEPUTY:

```text
all team non-deleted tasks
```

EMPLOYEE:

```text
task.assignedToId === actor.id
AND
task.deletedAt === null
```

---

# 31. Create Task Authorization

HEAD:

```text
target user ACTIVE
```

DEPUTY:

```text
target = self

OR

target.role = EMPLOYEE
AND target ACTIVE
```

EMPLOYEE:

```text
target = self only
```

For every role:

```text
createdById = authenticated actor
```

---

# 32. Update Task Authorization

Normal metadata editing:

```text
HEAD only
```

DEPUTY:

```text
DENY
```

EMPLOYEE:

```text
DENY
```

Assignment changes must use the dedicated reassign command.

Lifecycle status changes must use dedicated commands.

---

# 33. Reassign Authorization

HEAD only.

Requirements:

```text
task.status = OPEN
task.deletedAt IS NULL
new assignee ACTIVE
```

The transaction writes:

```text
task
audit_log
notification
```

---

# 34. Cancel Authorization

HEAD only.

Requirements:

```text
task.status = OPEN
task.deletedAt IS NULL
```

Result:

```text
status = CANCELLED
cancelledAt = now()
```

---

# 35. Delete Authorization

HEAD only.

Delete is soft delete.

Result:

```text
deletedAt = now()
deletedById = HEAD.id
```

No task hard deletion.

---

# 36. Progress Authorization

Normal progress submission is allowed only when:

```text
actor.id === task.assignedToId

AND

task.status === OPEN

AND

task.deletedAt === NULL
```

This applies to HEAD, DEPUTY and EMPLOYEE.

Being HEAD does not normally permit submitting progress as if HEAD were another employee.

HEAD administrative correction is a different operation:

```text
progress:correct
```

and is always audited.

---

# 37. Asset Read Authorization

HEAD:

```text
read all task assets
```

DEPUTY:

```text
read team task assets
```

EMPLOYEE:

```text
read assets where
task.assignedToId === actor.id
```

Soft-deleted assets are excluded from normal reads.

---

# 38. Asset Create Authorization

HEAD:

```text
may attach an asset to any non-deleted task
```

DEPUTY or EMPLOYEE:

```text
task.assignedToId === actor.id
AND
task.status === OPEN
AND
task.deletedAt === NULL
```

Therefore a DEPUTY cannot attach deliverables to an employee's task merely because the DEPUTY originally assigned that task.

---

# 39. Asset Delete Authorization

HEAD:

```text
may remove any active task asset
```

DEPUTY / EMPLOYEE:

```text
task.assignedToId === actor.id

AND

asset.createdById === actor.id

AND

task.status === OPEN

AND

asset.deletedAt === NULL
```

This prevents an employee from removing an asset inserted administratively by HEAD.

---

# 40. User Management Authorization

All user-management operations are HEAD-only:

```text
create
update
disable
enable
change role
reset password
```

DEPUTY and EMPLOYEE receive none of these permissions.

The final ACTIVE HEAD invariant must run before:

```text
disable HEAD
change HEAD role
```

---

# 41. Password Policy Authorization

HEAD:

```text
may change own password
may reset another user's password
```

DEPUTY:

```text
may not change own password
may not reset another password
```

EMPLOYEE:

```text
may not change own password
may not reset another password
```

UI hiding is insufficient.

The Better Auth endpoint itself must enforce this policy.

---

# 42. Server Boundary

Authorization must not be implemented only in:

```text
React component
button visibility
navigation
client hook
```

All mutations pass through server-side authorization.

Recommended structure:

```text
src/lib/authorization/
├── permissions.ts
├── roles.ts
└── policies/
    ├── task.policy.ts
    ├── asset.policy.ts
    ├── user.policy.ts
    ├── progress.policy.ts
    └── report.policy.ts
```

Business mutations:

```text
src/services/
├── tasks/
├── progress/
├── assets/
├── users/
├── audit/
└── notifications/
```

UI calls services indirectly through validated server actions or route handlers.

---

# 43. Validation Boundary

Every write operation has at least four guards:

```text
1. Input schema validation
2. Authentication
3. Authorization/resource policy
4. Database constraint/transaction
```

Zod validation is not authorization.

Database constraints are not authorization.

UI restrictions are not authorization.

The system requires all layers.

---

# 44. Google Drive Security Boundary

Only supported Drive URLs are accepted.

Do not render arbitrary user-provided URLs directly inside an iframe.

Provider URLs must be normalized and validated on the server.

Production CSP must explicitly control relevant directives such as:

```text
frame-src
img-src
media-src
```

Drive metadata/preview failures must fail safely.

---

# 45. Required Transaction Boundaries

The following operations are atomic:

```text
Complete task
Report incomplete
Correct progress
Reassign task
Cancel task
Delete task
Attach task asset + audit
Remove task asset + audit
Disable user
Change HEAD role
```

Any operation involving multiple business records must not leave partial state after failure.

---

# 46. Required Test Matrix

At minimum, automated tests must prove:

```text
EMPLOYEE cannot view another employee's private task.

EMPLOYEE cannot assign a task to another user.

EMPLOYEE cannot edit an existing task.

DEPUTY can assign a task to EMPLOYEE.

DEPUTY cannot assign a task to HEAD.

DEPUTY cannot edit a created task.

Only the current assignee can submit normal progress.

NOT_COMPLETED without reason is rejected.

A second task_daily_update for the same task/date is rejected.

COMPLETED updates Task atomically.

A failed completion transaction creates no partial data.

HEAD editing a task never changes createdById.

Only HEAD can reassign a task.

Only HEAD can cancel/delete a task.

Task deletion is soft deletion.

User deactivation maps to Better Auth banned state.

INACTIVE users cannot receive new tasks.

INACTIVE users cannot sign in.

The final ACTIVE HEAD cannot be disabled.

The final ACTIVE HEAD cannot be demoted.

Concurrent final-HEAD mutations cannot leave zero ACTIVE HEAD.

DEPUTY and EMPLOYEE cannot change their passwords.

HEAD can change own password.

HEAD can reset another user's password.

Only supported Drive URLs may create task assets.

Employee can attach a Drive asset to own OPEN task.

Employee cannot attach an asset to another user's task.

Employee cannot remove another user's asset.

Removing task asset does not delete Drive content.

Google preview failure does not break Task Detail.

Audit rows exist for all required privileged mutations.
```

---

# 47. Documentation Contract

Business baseline:

```text
docs/README-VN.md
docs/README.md
```

must now be updated to:

```text
Version 1.1
```

because Task Assets / Google Drive integration changes project business behavior.

Technical documentation should use:

```text
docs/
├── README-VN.md
├── README.md
│
├── 04-DATABASE-DESIGN-VN.md
├── 04-DATABASE-DESIGN.md
│
├── 05-AUTHORIZATION-MODEL-VN.md
├── 05-AUTHORIZATION-MODEL.md
│
└── CHANGELOG.md
```

Vietnamese and English technical documents must represent the same approved behavior.

---

# 48. New Business Invariants — V1.1

Add the following invariants to both README files.

## INV-13

Task assets are separate resources from Task content.

Adding or removing a task asset does not constitute editing Task ownership or task metadata.

## INV-14

DEPUTY and EMPLOYEE may normally attach assets only to OPEN tasks currently assigned to themselves.

## INV-15

Only approved external asset providers and validated URLs may be embedded or previewed.

V1 supports Google Drive.

## INV-16

External asset preview failure must never make the underlying Task unavailable.

## INV-17

Removing a task asset from CRM must not delete or modify the corresponding Google Drive source file.

## INV-18

Each task may have at most one official Daily Progress record per business date.

## INV-19

Daily Progress is immutable for ordinary users after submission.

HEAD corrections must use a separately authorized, audited correction workflow.

## INV-20

User IDs and application foreign keys use UUID under the approved Better Auth PostgreSQL configuration.

---

# 49. Baseline Decision

The schema and authorization model defined in this document are:

**APPROVED TECHNICAL BASELINE — V1.1**

Implementation agents must not alter:

- role semantics;
- ownership semantics;
- task lifecycle;
- Daily Progress uniqueness;
- password policy;
- account deactivation model;
- Drive asset authorization;
- deletion semantics;
- final HEAD protection;
- authorization boundaries;

without an explicit business decision and corresponding documentation update.
