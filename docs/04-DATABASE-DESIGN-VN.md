# Thiết kế Database — Version 1.1

**Trạng thái:** APPROVED TECHNICAL BASELINE — V1.1.
[Bản tiếng Anh tương đương](04-DATABASE-DESIGN.md). [Nghiệp vụ](README-VN.md).

Chỉ là thiết kế; schema/configuration/migration thực tế thuộc Phase 1. Phase 0 không kết nối hoặc sửa DB.

## Kiến trúc

Next.js full-stack monolith; Node 24 LTS; Railway Node service; Neon PostgreSQL + Drizzle stable + Postgres.js transaction trên connection. Không dựa Neon HTTP single-query; không Redis/queue/worker ngoài scope.

Better Auth sở hữu user/session/account/verification. Application sở hữu task/task_daily_update/task_asset/notification/audit_log. Sinh auth schema bằng CLI từ auth/plugin configuration thực tế, không tự dựng lại nội bộ.

## UUID và user

PostgreSQL native UUID cho entity ID và user foreign keys khi có thể. Phase 1 cấu hình:

```ts
advanced: {
  database: {
    generateId: "uuid",
  },
}
```

user.role canonical, đúng một HEAD/DEPUTY/EMPLOYEE, mặc định EMPLOYEE. Từ chối role rỗng/lạ/nhiều role. ACTIVE=banned=false, INACTIVE=banned=true. Không isActive/userStatus/deletedAt thứ hai để biểu diễn account state.

Không public registration. HEAD dùng Admin plugin create/update/list/read/set-role/ban/unban/set-password. Không delete/impersonate user/admin. Chặn generic user deletion/self-update/reset/change-password bypass; auth hook chỉ cho HEAD change-password. HEAD reset người khác qua administrative password-set. Initial HEAD controlled initialization; ordinary creation DEPUTY/EMPLOYEE, HEAD promotion riêng.

Luôn có role=HEAD AND banned=false. Chặn disable/demote HEAD ACTIVE cuối bằng transaction/concurrency, không count rồi update riêng rẽ.

## Enum

- task_status: OPEN, COMPLETED, CANCELLED.
- task_priority: LOW, NORMAL, HIGH, URGENT.
- task_progress_status: COMPLETED, NOT_COMPLETED.
- task_asset_provider: GOOGLE_DRIVE.
- task_asset_type: IMAGE, VIDEO, DOCUMENT, SPREADSHEET, PRESENTATION, PDF, OTHER.
- Notification types có thể enum supported events; audit actions application-controlled string constants dễ mở rộng.

## DATE và TIMESTAMPTZ

assigned_date/due_date/report_date là business DATE theo Asia/Ho_Chi_Minh; created/updated/completed/cancelled/deleted/corrected/read timestamps là event TIMESTAMPTZ instant. Không cắt UTC thành business date. Bảng dưới giữ nguyên SQL identifiers/types/nullability.

## task

created_by_id độc lập assigned_to_id, bất biến ordinary editing. User FK ON DELETE RESTRICT. Title varchar(200), trim khác rỗng. due_date NULL hoặc >= assigned_date. OPEN completed_at/cancelled_at NULL; COMPLETED completed_at NOT NULL/cancelled_at NULL; CANCELLED cancelled_at NOT NULL/completed_at NULL.

Server xác định creator=actor/status OPEN/all lifecycle-delete times NULL lúc tạo, client không cung cấp creator. HEAD target ACTIVE bất kỳ; DEPUTY self/ACTIVE EMPLOYEE; EMPLOYEE self.

Command riêng: updateTaskMetadata/reassignTask/cancelTask/softDeleteTask/submitTaskProgress/correctTaskProgress; không updateTask(anyPatch). Metadata không nhận createdById/status/completedAt/cancelledAt/deletedAt/deletedById. HEAD reassign/cancel chỉ OPEN chưa xóa.

## task_daily_update

UNIQUE(taskId, reportDate), SQL UNIQUE(task_id, report_date). Server report_date Asia/Ho_Chi_Minh; client không chọn arbitrary date. user_id=current assignee. NOT_COMPLETED reason NOT NULL/trim khác rỗng; COMPLETED reason NULL. Ordinary users không UPDATE/DELETE sau gửi.

COMPLETED transaction: validate session/ownership/task OPEN/not deleted; insert daily report; update task COMPLETED/completed_at; insert audit; commit. Lỗi rollback tất cả. NOT_COMPLETED tương tự nhưng required reason và task vẫn OPEN.

HEAD correction riêng: lock/load task+report; sửa report; correctedAt/correctedById/correctionReason bắt buộc; before/after audit; NOT_COMPLETED → task OPEN/completedAt NULL; COMPLETED → task COMPLETED/completedAt current correction time; commit. Giữ một row/task/ngày.

## task_asset

GOOGLE_DRIVE only. Validate supported required Drive/Docs domains; normalize server-side; extract providerFileId/fileName/mimeType/assetType khi có. Không arbitrary iframe/expiring thumbnail permanent storage.

Partial unique (task_id, provider, provider_file_id) WHERE deleted_at IS NULL; re-add sau soft-delete được phép. Removal chỉ CRM deleted_at/deleted_by_id + audit, không source Drive deletion/modification.

Preview lỗi permission/file removed/unavailable/network/API vẫn giữ Task Detail, thông báo lỗi và Open in Google Drive. CRM authorization riêng Drive permissions.

## notification và audit_log

Notification persisted; không cần WebSocket. Candidate TASK_ASSIGNED/TASK_UPDATED/TASK_REASSIGNED/TASK_CANCELLED; user FK RESTRICT, read_at NULL chưa đọc.

Audit append-only; ordinary service không update/delete. actor_user_id NULL chỉ legitimate system operations; user events phải actor. before/after/metadata/requestId/IP/userAgent khi phù hợp.

Events: LOGIN, CREATE_USER, UPDATE_USER, DISABLE_USER, ENABLE_USER, CHANGE_ROLE, RESET_PASSWORD, CHANGE_OWN_PASSWORD, CREATE_TASK, UPDATE_TASK, REASSIGN_TASK, CANCEL_TASK, DELETE_TASK, MARK_TASK_COMPLETED, MARK_TASK_NOT_COMPLETED, CORRECT_TASK_PROGRESS, ADD_TASK_ASSET, REMOVE_TASK_ASSET.

## Soft delete và indexes

Task deleted_at: xóa khỏi operation. Asset deleted_at: gỡ CRM association. User banned=true: deactivate. Không ordinary DELETE user/task/task_asset. FK restrictive tránh accidental deletion.

Task active partial indexes: (assigned_to_id,assigned_date), (assigned_to_id,status), (status,assigned_date), (due_date); thêm (created_by_id). Daily unique(task_id,report_date), index(user_id,report_date). Asset active task_id index và active unique file association. Notification(user_id,read_at,created_at). Audit(actor_user_id,created_at), (entity_type,entity_id,created_at).

## Bảng canonical

### task

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

### task_daily_update

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

### task_asset

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

### notification

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

### audit_log

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

Task/daily/asset/notification foreign keys trong thiết kế là ON DELETE RESTRICT. Không thay role/ownership/lifecycle/uniqueness/password/banned/Drive deletion/final HEAD/server boundary nếu chưa có business decision và bilingual docs update. [Authorization](05-AUTHORIZATION-MODEL-VN.md).
