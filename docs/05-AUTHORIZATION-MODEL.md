# Authorization Model — Version 1.1

**Status:** APPROVED. Design only; no business authorization implementation in Phase 0.

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

## Authentication and identity invariants

Better Auth owns user, session, account, verification. Exactly one canonical role: HEAD, DEPUTY, EMPLOYEE. ACTIVE = banned=false; INACTIVE = banned=true. No duplicate isActive/status field. No public registration. HEAD alone administers users/passwords; user deletion and impersonation are denied. Generic identity/self-password endpoints cannot bypass policy. Preserve the final ACTIVE HEAD with transactional concurrency protection. UUID generation uses advanced.database.generateId = uuid in Phase 1.

Daily updates are UNIQUE(taskId, reportDate), immutable to ordinary users. HEAD correction is a separately authorized audited exception. createdById never changes on task edits. Task and asset deletion are soft deletion; asset removal never modifies/deletes Drive source content. Business dates use Asia/Ho_Chi_Minh.

[Database design](04-DATABASE-DESIGN.md). [Vietnamese model](05-AUTHORIZATION-MODEL-VN.md).

## Phase 1 auth foundation - 2026-09-18

Business baseline remains V1.1. Canonical server-only auth uses shared options, PostgreSQL Drizzle transactions, email/password, disabled public signup and self-deletion, and UUID IDs. Admin plugin custom roles are exactly HEAD, DEPUTY, EMPLOYEE; default EMPLOYEE. HEAD alone receives user create/list/get/update/set-role/ban/set-password/set-email. All roles have no session-administration privileges; DEPUTY/EMPLOYEE have no user-administration privileges. No wildcard, adminUserIds bypass, delete, impersonate or impersonate-admins grant exists. Hooks and the database CHECK reject invalid or comma-separated/multiple roles. user.role is canonical; banned=false means ACTIVE and banned=true means INACTIVE, with non-null defaults EMPLOYEE/false. No duplicate activation field exists.

No external auth handler is exposed. These are persistence/access-control primitives, not the Phase 2 CRM authorization service. Before exposing any handler, enforce final ACTIVE HEAD protection transactionally, permanent deactivation semantics (ban expiry must not silently reactivate an INACTIVE account), protected role/ban fields, HEAD-only password administration and approved self-service policy. UI hiding is never authorization. Task permissions, daily immutability, asset provider validation/preview and audit persistence remain future server-side services. Removing a CRM asset must never delete its Drive source. See the bilingual database design Phase 1 section for schema generation and verification workflow.

## Phase 2 implementation - 2026-09-18 (business V1.1 unchanged)

The Phase 1 statement above describes that phase's historical boundary. Phase 2 exposes the official Better Auth 1.7.5 Next.js handler at `/api/auth/[...all]`, with an exact method/path allowlist: POST sign-in/email, POST sign-out and GET get-session. All signup, public reset, generic self-update/change-email/change-password, deletion, impersonation and generic admin HTTP paths are denied, including for HEAD. Additional library routes introduced by future upgrades stay closed by default. HEAD own-password changes use the audited application operation; a Better Auth before hook independently denies change-password to non-HEAD actors. Public signup remains disabled in Better Auth itself, including server API calls.

`/login` has no registration or public forgot-password flow. Successful login and authenticated visits to login redirect to fixed `/app`; client-supplied external redirects are rejected. Protected layouts and pages use a canonical server session helper, query the real session without cookie-cache authorization, re-read the canonical user and reject banned/invalid-role actors. `/users` and `/account/password` require HEAD before reading data; forbidden authenticated pages redirect to a controlled access-denied screen without user-list data. API denial is 401/403. DEPUTY/EMPLOYEE navigation hiding is supplementary.

HEAD explicitly receives user:create, user:read, user:update, user:disable, user:enable, user:change-role and user:reset-password. DEPUTY/EMPLOYEE receive none. There is no wildcard. `/api/users` supports list/create; `/api/users/[id]` accepts separate strict commands for identity update, role change, disable, enable and reset-password. `/api/users/own-password` is a separate HEAD operation. Every service entry derives its actor from a signed server session and fresh canonical DB user after acquiring the administration transaction lock; client actor IDs/roles are never authorization. Inputs use strict Zod schemas; UUID IDs and normalized lowercase/trimmed emails are validated. Normal creation allows only DEPUTY/EMPLOYEE, initially ACTIVE. HEAD promotion is an explicit role-change action. Identity edit accepts only name/email; role, activation and password cannot be smuggled into it. Email changes reset email verification and revoke target sessions; old email stops authenticating while the new email uses the same credential account. Role changes and password resets also revoke sessions.

Password policy: 12–128 characters, nonblank, without trimming or altering the supplied password. Prefer a unique passphrase; no arbitrary composition requirement. Better Auth hashes credentials. HEAD own-password change requires current-password verification; successful change revokes all sessions and requires login again. Reset applies only to another existing user. DEPUTY/EMPLOYEE cannot change or reset any password. There is no business user hard-delete operation.

All administrative writes, bootstrap and login use PostgreSQL advisory transaction lock key 24091802. Acquire it before re-reading actor/target or counting ACTIVE HEAD users, then hold through mutation and audit commit. PostgreSQL READ COMMITTED sees preceding committed changes after lock acquisition; competing demotions/deactivations cannot both remove the last ACTIVE HEAD. Only role=HEAD AND banned=false counts. All activation/role entry points share this lock; generic admin routes remain closed. Before disabling/demoting an ACTIVE HEAD, require another ACTIVE HEAD. Disable persists banned=true with no ban expiry and revokes sessions; enable clears ban metadata. Better Auth banUser handles other-user disable. Its self-ban restriction is narrower than the approved business rule, so self-disable uses an explicit transaction-bound canonical ban update plus session deletion, after the same final-HEAD check. User records and historical relationships remain intact.

The runtime auth factory can bind the Drizzle adapter to the caller's transaction. Administrative Better Auth API writes and audit inserts therefore share the same PostgreSQL transaction; no compensating separate commit is claimed. Sign-in runs the official handler within a transaction; the session-create hook writes LOGIN only for successful email sign-in. An unsuccessful handler response triggers rollback before it is returned; successful cookies are delivered after commit. Audit failure rolls back user/session mutations. Application audit payloads are whitelisted identity/role/banned summaries, never password, password hash, session token or arbitrary client metadata. Events: LOGIN, CREATE_USER, UPDATE_USER, CHANGE_ROLE, DISABLE_USER, ENABLE_USER, RESET_PASSWORD, CHANGE_OWN_PASSWORD. Bootstrap uses CREATE_USER with bootstrap=true. IP/user-agent values are not invented or collected by this foundation.

Better Auth's default origin/CSRF protections remain enabled. Authentication POST and custom administration POST additionally require exact configured application Origin; unknown/cross-origin requests fail. No unsafe origin bypass is configured. Responses and client errors omit raw library/driver details. No auth credentials are recorded in client telemetry. Server-only runtime/session boundaries prevent DB/secret imports into client components. Per-request React session caching is not cross-user authorization caching.

`npm run auth:bootstrap-head` is an explicit development-only command requiring private KIG_BOOTSTRAP_HEAD_NAME, KIG_BOOTSTRAP_HEAD_EMAIL and KIG_BOOTSTRAP_HEAD_PASSWORD, plus the validated server environment and KIG_DATABASE_ENV=development. It refuses if an ACTIVE HEAD exists and creates user, credential account and bootstrap audit atomically under the same lock. It prints no identity/password/token. No permanent initial account is auto-created: the operator supplies values privately. Production bootstrap belongs to authorized rollout: verify target identity and migration state, privately supply operator-selected inputs, review the production target gate explicitly, and retain the same lock/refusal/audit algorithm. The development command does not silently permit production.

Real PostgreSQL auth tests use a rollback transaction on an empty development account baseline. Competing transactions and browser tests use random namespaced fixture accounts and passwords kept only in memory, with cleanup of owned audit/session/account/user records. This test-only cleanup is not an application hard-delete flow. Chromium runs on the local configured auth origin, on desktop/mobile. Credential-bearing auth traces are disabled. No Phase 3 permissions/workflows are implemented.

## Phase 3 Task authorization implementation - 2026-09-18

The Phase 2 statement above is historical. Business V1.1 is unchanged. Explicit Task grants/policies live in `src/lib/tasks/policy.ts`. HEAD has all eight approved Task permissions; DEPUTY has create-self/create-for-others/read-self/read-team; EMPLOYEE has create-self/read-self. No wildcard or client actor trust. Canonical Phase 2 session/user helpers derive every actor; banned or missing actors receive 401. The transaction lock coordinates with account administration before canonical reads.

HEAD and DEPUTY read all non-deleted team tasks; EMPLOYEE reads only current assigned work. A reassigned-away task is unavailable even to its Employee creator. Both hidden and unauthorized detail IDs return the same 404, without task content. Task pages enforce server sessions; HEAD edit checks role before reading resource data. Navigation/control hiding supplements API/service authorization.

Creation permits HEAD to assign any ACTIVE user, DEPUTY self or ACTIVE EMPLOYEE, EMPLOYEE self only. Invalid/inactive/nonexistent targets fail without silently replacing assignee. The server controls createdById, OPEN status and null lifecycle/deletion fields. Active user selectors return only ID/name/role, filtered by the same role semantics; selectors do not authorize writes. Reassignment is HEAD-only, OPEN/non-deleted, to any ACTIVE user; creator remains immutable and previous Employee access is immediately lost. Same-assignee reassignment is rejected as a no-op.

`/api/tasks` GET lists and POST creates; GET `/api/tasks/assignees` gives eligible selectors; GET `/api/tasks/[id]` reads detail. POST `/api/tasks/[id]/metadata`, `/reassign`, `/cancel`, `/soft-delete` each maps to one explicit service command. No broad patch, HTTP hard-delete handler, completion/status endpoint or restore. Unknown commands fail. Mutations require exact configured Origin and no-store responses; existing Better Auth origin/CSRF protections remain intact.

Strict Zod metadata accepts only title, description, assignedDate, dueDate, priority; all five are provided for full metadata editing. Creation also accepts assignedToId; omitted description/dueDate default null and priority defaults NORMAL. Title is trimmed/nonblank/max 200; optional description max 10,000 characters is a technical input bound; dates must be real ISO calendar dates with dueDate>=assignedDate; priority is LOW/NORMAL/HIGH/URGENT; IDs are UUID. Privileged fields and assignee in metadata edits are rejected, including creator, role/actor, status, completion/cancellation and deletion metadata. Reassign accepts only assignedToId; cancel/delete accept only an empty command body.

Only HEAD edits metadata, reassigns, cancels or soft-deletes. Metadata/reassign/cancel require OPEN; CANCELLED/COMPLETED metadata cannot be edited normally. Cancellation sets CANCELLED/cancelledAt now/completedAt null and preserves visible history. Soft deletion is independent of status, sets paired actor/time, preserves creator/status/dependent history and excludes the task from every normal list/detail. Application commands never hard-delete. Phase 3 cannot mark COMPLETED; completion is reserved exclusively for Phase 4 Daily Progress.

Mutation, business-safe before/after audit and required notification share one transaction. Exclusive advisory lock 24091802 precedes row FOR UPDATE and fresh lifecycle validation; shared lock protects read/account consistency. Competing cancellation/reassignment or deletion/edit cannot blindly mutate stale OPEN state. A reassignment that commits first may validly precede cancellation; a cancellation that commits first causes reassignment to fail. Atomicity and blocked-writer behavior are verified on PostgreSQL, including injected database failures. See bilingual database Phase 3 sections for notification rules and test-only historical fixtures/cleanup.

UI: mobile-first task cards, protected detail, create and HEAD metadata edit pages at `/tasks`, `/tasks/[id]`, `/tasks/new`, `/tasks/[id]/edit`; dedicated HEAD reassignment and confirmed cancel/delete actions on detail. Employee assignee is fixed to self; DEPUTY selector excludes other DEPUTY/HEAD/inactive accounts. Status/priority are text, not color alone. Quicksand and light/dark/system themes persist. No Daily Progress, assets, Calendar, Dashboard, analytics or notification-center UI.

## Phase 4 Progress authorization - 2026-09-18 (V1.1)

The Phase 3 boundary above is historical. HEAD/DEPUTY/EMPLOYEE explicitly receive progress:create-own; HEAD alone progress:correct. Every command derives canonical ACTIVE actor after advisory coordination, and normal submission additionally requires current assignee, OPEN, non-deleted parent. HEAD cannot report on another user's behalf. Reads inherit the Task resource policy; previous Employee assignee loses history access after reassignment, and deleted/inaccessible IDs reveal no content. HEAD correction is latest/status-changing only, with full administrative reason/audit; it never undoes cancellation. See bilingual database sections and business safeguards for chronology/same-day reporting consequences.

GET `/api/tasks/[id]/progress` returns authorized safe history, derived business today and server-controlled UI eligibility. POST at that path submits strict status-specific payload. POST `/api/tasks/[id]/progress/[progressId]/correct` is a separate HEAD-only strict correction. No generic PATCH/DELETE progress or task status/reopen endpoint. Exact configured Origin required for mutations, no-store responses, controlled 401/403/404/409 and input 400; unexpected driver/library errors return generic 503 without logging credentials. Existing Better Auth protections unchanged. Technical reason bound 5,000 characters applies to both incomplete and correction reasons. UI uses a focus-managed shadcn Dialog with mobile scrolling; ordinary reporting and HEAD administrative correction are visibly separate. No asset/calendar/dashboard/report/notification-center functionality.

## Phase 5 Google Drive Task Assets authorization - 2026-09-19

Phase 5 implements Task Asset permissions adhering to approved baseline V1.1:

- `asset:create-any`: HEAD may attach supported Google Drive assets to any non-deleted task (`OPEN`, `COMPLETED`, `CANCELLED`).
- `asset:create-own`: DEPUTY and EMPLOYEE may attach supported Google Drive assets only to their own currently assigned, `OPEN`, non-deleted task (`task.assignedToId === actor.id && task.status === "OPEN" && task.deletedAt === null`). They cannot attach assets to tasks assigned to others or tasks that are completed/cancelled.
- `asset:read-team`: HEAD and DEPUTY read all active assets belonging to non-deleted accessible team tasks.
- `asset:read-own`: EMPLOYEE reads active assets belonging only to tasks currently assigned to them. Foreign task assets return 404 (or 403). Soft-deleted assets are hidden from all standard operational reads.
- `asset:delete-any`: HEAD may soft-remove any active asset on any non-deleted task.
- `asset:delete-own`: DEPUTY and EMPLOYEE may soft-remove only an asset that they personally created (`asset.createdById === actor.id`) on a task currently assigned to them (`task.assignedToId === actor.id`) while the task is `OPEN` and not deleted. They cannot remove assets attached by HEAD or other team members.

Google Drive authorization is strictly decoupled from CRM authorization. The CRM verifies metadata via a server-side service account with minimal read-only scope (`https://www.googleapis.com/auth/drive.metadata.readonly`). The service account never requests write permissions. User input is validated against a strict host allowlist (`drive.google.com`, `docs.google.com`); arbitrary URLs, javascript/data schemes, and folder URLs are rejected. Client requests cannot supply file IDs, names, MIME types, or asset types.

Inline previews are rendered inside sandboxed iframes from canonical Google preview endpoints under CSP `frame-src 'self' https://drive.google.com https://docs.google.com;`. If an end-user lacks permission in their own Google account to view the file, the CRM UI provides a prominent "Mở trên Google Drive ↗" fallback link. Soft removal in CRM never calls Google Drive deletion or permission modification APIs.
