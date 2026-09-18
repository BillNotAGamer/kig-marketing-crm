# Mô hình Authorization — Version 1.1

**Trạng thái:** APPROVED TECHNICAL BASELINE — V1.1.
[Bản tiếng Anh](05-AUTHORIZATION-MODEL.md) · [Database](04-DATABASE-DESIGN-VN.md) · [Nghiệp vụ](README-VN.md).

Đây là thiết kế cho phase sau; Phase 0 không triển khai authorization/business services.

## Auth và identity

Better Auth sở hữu user/session/account/verification. ID UUID và user foreign keys UUID; cấu hình PostgreSQL advanced.database.generateId="uuid" ở Phase 1. user.role là canonical, đúng một HEAD/DEPUTY/EMPLOYEE, mặc định EMPLOYEE. Không role list/unknown/empty.

ACTIVE=banned=false, INACTIVE=banned=true; không duplicate isActive/status. Không public registration. Initial HEAD controlled bootstrap, normal creation DEPUTY/EMPLOYEE, promote HEAD explicit. HEAD-only create/read/list/update/ban/unban/set-role/set-password. Không delete/impersonate user/admin. Generic self-update/delete/reset/change-password không bypass. HEAD đổi own password/reset người khác; DEPUTY/EMPLOYEE không được cả hai.

Ít nhất một ACTIVE HEAD bất kỳ lúc nào. Disable/demote final ACTIVE HEAD bị từ chối; transaction/concurrency protection, không count rồi update không khóa.

## Authorization architecture

Authentication + RBAC + Resource Ownership + Contextual Business Policy. RBAC riêng không đủ. Request → authenticated? → role allows? → resource policy allows? → valid lifecycle/business transition? → transaction.

Mỗi write có input schema validation, authentication, authorization/resource policy, database constraints/transaction. Zod/database constraint/UI restrictions không thay authorization. Không wildcard production permission; enumerate HEAD permissions.

## Permission vocabulary

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

## Task visibility và creation

HEAD đọc tất cả non-deleted tasks; DEPUTY đọc team non-deleted tasks; EMPLOYEE task.assignedToId=actor.id AND deletedAt=null. Creator không đồng nghĩa current owner.

HEAD tạo cho ACTIVE target bất kỳ. DEPUTY self hoặc ACTIVE EMPLOYEE, không HEAD/DEPUTY khác. EMPLOYEE self only. Mọi role createdById=authenticated actor, không client supplied.

## Metadata, reassign, cancel, delete

Normal metadata editing HEAD-only; DEPUTY/EMPLOYEE deny. createdById bất biến. Không generic patch cho status/timestamps/creator/deletion. Dedicated commands cho assignment/lifecycle.

Reassign HEAD-only: OPEN, non-deleted, target ACTIVE; transaction task+audit+notification. Cancel HEAD-only: OPEN/non-deleted, CANCELLED/cancelledAt=now. Delete HEAD-only soft deletion: deletedAt=now/deletedById=HEAD actor. Không hard deletion.

## Progress

Ordinary submission mọi role chỉ current assignee trên OPEN/non-deleted task. HEAD không báo thay EMPLOYEE. Server business reportDate Asia/Ho_Chi_Minh; UNIQUE(taskId,reportDate). NOT_COMPLETED reason required/non-whitespace, COMPLETED reason NULL. Ordinary records immutable: không sửa/xóa sau gửi.

HEAD progress:correct là separate audited administrative exception, reason/time/actor bắt buộc. Audit full before/after, parent lifecycle cập nhật atomic. COMPLETED → NOT_COMPLETED mở OPEN/xóa completedAt; corrected COMPLETED đặt completion current time. Một row/task/ngày giữ nguyên.

## Asset permissions

Read: HEAD all/team; DEPUTY team; EMPLOYEE current-assigned task. Apply non-deleted parent visibility, exclude soft-deleted asset.

Create: HEAD any non-deleted task; DEPUTY/EMPLOYEE only assignedToId=actor AND OPEN AND non-deleted. DEPUTY creator của EMPLOYEE task không có quyền attach chỉ vì creator.

Remove: HEAD any active association. DEPUTY/EMPLOYEE current assignee AND asset.createdById=actor AND task OPEN/non-deleted AND asset active. Không xóa association HEAD đã thêm. Removal soft deletion/audit, tuyệt đối không delete/modify Drive source content.

## User/password management

All user create/read/update/disable/enable/change-role/reset-password HEAD-only. DEPUTY/EMPLOYEE không có. Trước disable HEAD/change HEAD role, enforce final ACTIVE HEAD transaction-safe. Inactive không sign in/new assignments.

Password policy phải bảo vệ endpoint Better Auth, không chỉ hidden UI. HEAD only change own/reset others; normal generic endpoints không bypass.

## Server boundary và cấu trúc khuyến nghị

Không chỉ React/button/nav/client-hook authorization. Mutations qua server authorization và validated Server Action/Route Handler gọi service. Recommended future src/lib/authorization/{permissions.ts,roles.ts,policies/{task,asset,user,progress,report}.policy.ts}; src/services/{tasks,progress,assets,users,audit,notifications}. Đây là thiết kế, không tạo business scaffolding Phase 0.

## Google Drive security

Chỉ supported Drive/Docs URLs validated/normalized server-side. Không arbitrary user URL iframe. Production CSP kiểm soát frame-src/img-src/media-src. Metadata/preview failure fail safely: task vẫn available, fallback thông báo/Open Drive. CRM permission không grant Drive permission. Credential model/API deferred đến integration phase.

## Required atomic transactions

Complete task, report incomplete, correct progress, reassign, cancel, soft delete task, attach asset+audit, remove asset+audit, disable user, change HEAD role. Nhiều business records không được partial state khi failure. Connection-based Postgres.js hỗ trợ transaction Railway+Neon; không HTTP single-query design.

## Required test matrix cho các phase triển khai

- EMPLOYEE không xem private task của người khác, không assign người khác, không edit existing task.
- DEPUTY assign EMPLOYEE được, không assign HEAD, không edit existing task.
- Chỉ current assignee submit progress; NOT_COMPLETED không reason bị reject.
- Daily update thứ hai cùng task/date bị reject.
- COMPLETED update parent atomically; failure không partial data.
- HEAD edit không đổi createdById.
- HEAD-only reassign/cancel/delete, delete là soft.
- User deactivate maps banned; inactive không sign in/receive work.
- Final ACTIVE HEAD không disable/demote; concurrent changes không để zero ACTIVE HEAD.
- DEPUTY/EMPLOYEE không change password; HEAD own-change/reset others được.
- Chỉ supported Drive URLs tạo asset; employee attach own OPEN task được, other task bị reject.
- Employee không remove other's asset; remove không delete source Drive.
- Preview failure không phá Task Detail.
- Audit tồn tại cho tất cả privileged mutations bắt buộc.

Không tạo fake business tests ở Phase 0. Mọi business change phải cập nhật hai ngôn ngữ/tests; code/docs discrepancy phải báo thay vì âm thầm chọn. [INV-01–20](README-VN.md) bắt buộc.
