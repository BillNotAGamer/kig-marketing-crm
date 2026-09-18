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
