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

## Bằng chứng triển khai Phase 1 - 2026-09-18 (giữ nguyên V1.1)

Schema tổng hợp tại `src/db/schema/index.ts`. Bốn bảng xác thực: `user`, `session`, `account`, `verification`; năm bảng ứng dụng: `task`, `task_daily_update`, `task_asset`, `notification`, `audit_log`. Cả chín khóa chính và các khóa ngoại người dùng/công việc dùng PostgreSQL UUID. ID ứng dụng mặc định `gen_random_uuid()`; Better Auth cấu hình `advanced.database.generateId="uuid"`. Tất cả 13 khóa ngoại dùng ON DELETE RESTRICT, kể cả account/session; không xóa dây chuyền.

Enum PostgreSQL: `task_status` (OPEN, COMPLETED, CANCELLED), `task_priority` (LOW, NORMAL, HIGH, URGENT), `task_progress_status` (COMPLETED, NOT_COMPLETED), `task_asset_provider` (GOOGLE_DRIVE), `task_asset_type` (IMAGE, VIDEO, DOCUMENT, SPREADSHEET, PRESENTATION, PDF, OTHER), `notification_type` (TASK_ASSIGNED, TASK_UPDATED, TASK_REASSIGNED, TASK_CANCELLED). NOT_REPORTED được suy ra, không lưu.

14 CHECK bảo vệ vai trò chuẩn duy nhất; tiêu đề công việc không rỗng; thứ tự ngày, vòng đời và cặp thông tin xóa mềm công việc; lý do báo cáo và thông tin hiệu chỉnh; ID nhà cung cấp/URL nguồn tài sản không rỗng và cặp thông tin xóa mềm; tiêu đề/nội dung thông báo không rỗng; action/entity type nhật ký không rỗng. Báo cáo có `UNIQUE(task_id, report_date)`. Email người dùng và token phiên giữ tính duy nhất do CLI sinh. Tài sản có duy nhất từng `(task_id, provider, provider_file_id) WHERE deleted_at IS NULL`, cho phép đính kèm lại sau xóa mềm.

14 index tường minh gồm ba index tra cứu xác thực và 11 index ứng dụng: công việc theo người nhận/ngày, người nhận/trạng thái, trạng thái/ngày, hạn chót (đều chỉ bản ghi chưa xóa), người tạo; báo cáo theo người/ngày; tài sản theo công việc chưa xóa và duy nhất tài sản chưa xóa; thông báo theo người/đã đọc/thời điểm tạo; audit theo người thực hiện/thời điểm và loại thực thể/ID/thời điểm. Sáu index là partial. Quan hệ nhiều khóa ngoại tới user có tên rõ ràng khớp hai chiều. Xuất kiểu insert/select suy ra cho năm bảng ứng dụng.

assigned_date, due_date, report_date là DATE dạng chuỗi; mọi thời điểm sự kiện là TIMESTAMPTZ. Diễn giải ngày nghiệp vụ dùng Asia/Ho_Chi_Minh. Người dùng thường không sửa báo cáo; audit chỉ thêm về mặt nghiệp vụ. Lớp dịch vụ ở phase sau thực thi các quy tắc này; không tạo repository sửa/xóa tổng quát.

`npm run auth:schema` dùng CLI ổn định `auth@1.7.5`, đọc cấu hình dùng chung `src/lib/auth/options.ts` qua `scripts/auth-schema.config.mts`. Lưu nguyên đầu ra tại `auth.generated.ts`; chuẩn hóa xác định tạo `auth.ts` với TIMESTAMPTZ và CHECK vai trò. Mặc định role/banned bắt buộc và khóa ngoại RESTRICT xuất phát từ metadata plugin dùng chung. Không đưa bản thô vào schema migration tổng hợp. `auth:schema:check` sinh lại và so sánh cả hai bản. CLI ngoại tuyến dùng secret ngẫu nhiên tạm thời riêng cho công cụ, không mở DB và cảnh báo vì chưa có base URL; runtime kiểm tra thông tin môi trường thật.

Postgres.js hỗ trợ transaction cho Railway + Neon. Singleton DB server-only khởi tạo lười và tái sử dụng kết nối khi hot reload; adapter Drizzle PostgreSQL của Better Auth bật transaction. UI không import DB.

Quy trình: sinh lại auth, duyệt diff, `npm run db:generate`, duyệt SQL, rồi `npm run db:migrate` chỉ với DB phát triển trống đã được cho phép rõ ràng. Migration đầu tiên `drizzle/0000_initial_v1_1.sql` cùng snapshot/journal quản lý bằng Git; không sửa SQL thủ công. `db:migrate`, `db:verify`, `db:studio`, `test:db` yêu cầu `KIG_DATABASE_ENV=development` và DATABASE_URL phát triển riêng tư. Preflight từ chối bảng/enum public hoặc journal Drizzle đã tồn tại; không xóa dữ liệu để vượt chốt. Từ chối tên đích có dấu hiệu production nhưng người vận hành vẫn phải xác minh danh tính đích. Studio chỉ dùng phát triển; không dùng push làm quy trình chính.

`db:check` kiểm tra metadata migration và sinh lại auth ngoại tuyến. `db:verify` kiểm tra catalog thật. `test:db` kiểm tra ràng buộc PostgreSQL bằng fixture trong transaction được rollback, không cấp thông tin đăng nhập hay seed vĩnh viễn. Lần triển khai ngoại tuyến ban đầu chưa có DB phát triển được cho phép. Khi đóng Phase 1, migration đầu tiên không thay đổi đã được áp dụng trên PostgreSQL phát triển được cho phép; catalog thật và kiểm thử tích hợp có transaction đều đạt, không còn bản ghi fixture. Không tạo DB production, HEAD ban đầu, route HTTP auth hoặc dịch vụ Phase 2.
