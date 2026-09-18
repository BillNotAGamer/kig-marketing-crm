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

## Nền tảng auth Phase 1 - 2026-09-18

Giữ nguyên V1.1. Auth server-only dùng cấu hình chung, adapter Drizzle PostgreSQL bật transaction, email/password, tắt đăng ký công khai và tự xóa tài khoản, ID UUID. Admin plugin chỉ có HEAD, DEPUTY, EMPLOYEE; mặc định EMPLOYEE. Chỉ HEAD được user create/list/get/update/set-role/ban/set-password/set-email. Mọi vai trò không có quyền quản trị session; DEPUTY/EMPLOYEE không quản trị user. Không cấp wildcard, bỏ qua qua adminUserIds, delete, impersonate hoặc impersonate-admins. Hook và CHECK DB từ chối vai trò sai hoặc nhiều vai trò/ngăn cách dấu phẩy. user.role là chuẩn; banned=false là ACTIVE, banned=true là INACTIVE, mặc định bắt buộc EMPLOYEE/false. Không có cột kích hoạt trùng lặp.

Không mở route auth HTTP. Đây là primitive lưu trữ/phân quyền, chưa phải dịch vụ phân quyền CRM Phase 2. Trước khi mở handler phải bảo vệ HEAD ACTIVE cuối cùng trong transaction, duy trì vô hiệu hóa vĩnh viễn (ban expiry không tự kích hoạt lại INACTIVE), bảo vệ trường role/ban, quản trị mật khẩu chỉ HEAD và chính sách tự phục vụ đã duyệt. Ẩn UI không phải phân quyền. Quyền task, bất biến báo cáo, xác thực nhà cung cấp/preview tài sản và lưu audit thuộc dịch vụ server ở phase sau. Xóa liên kết CRM không bao giờ xóa tệp Drive nguồn. Xem phần Phase 1 trong thiết kế DB song ngữ về sinh schema và xác minh.

## Triển khai Phase 2 - 2026-09-18 (giữ nguyên nghiệp vụ V1.1)

Phần Phase 1 ở trên mô tả ranh giới lịch sử của phase đó. Phase 2 mở handler Next.js chính thức của Better Auth 1.7.5 tại `/api/auth/[...all]`, với danh sách method/path chính xác: POST sign-in/email, POST sign-out, GET get-session. Từ chối mọi route signup, reset công khai, tự sửa thông tin/change-email/change-password, xóa, impersonation và admin HTTP tổng quát, kể cả HEAD. Route mới trong bản nâng cấp cũng mặc định bị đóng. HEAD đổi mật khẩu qua thao tác ứng dụng có audit; before hook Better Auth độc lập từ chối change-password cho người không phải HEAD. Better Auth vẫn tắt đăng ký công khai, kể cả gọi API server.

`/login` không có đăng ký hoặc quên mật khẩu công khai. Đăng nhập thành công và truy cập login khi đã đăng nhập đều chuyển đến `/app` cố định; từ chối redirect ngoài ứng dụng từ client. Layout/page bảo vệ dùng helper session server chuẩn, đọc session thật không dùng cookie cache để phân quyền, đọc lại user chuẩn và từ chối banned/vai trò sai. `/users`, `/account/password` kiểm tra HEAD trước khi đọc dữ liệu; người đã đăng nhập nhưng không đủ quyền được chuyển đến màn hình access-denied không lộ danh sách user. API trả 401/403. Ẩn navigation chỉ bổ trợ.

HEAD được cấp tường minh user:create, user:read, user:update, user:disable, user:enable, user:change-role, user:reset-password; DEPUTY/EMPLOYEE không có quyền nào, không wildcard. `/api/users` đọc/tạo; `/api/users/[id]` nhận các lệnh riêng, schema strict: sửa danh tính, đổi vai trò, disable, enable, reset-password. `/api/users/own-password` là thao tác HEAD riêng. Mọi service suy ra actor từ session có chữ ký và user DB chuẩn mới đọc sau khi lấy khóa transaction quản trị; không dùng ID/vai trò actor do client gửi để cấp quyền. Zod strict kiểm tra UUID, email trim/chữ thường. Tạo thông thường chỉ DEPUTY/EMPLOYEE ACTIVE; thăng HEAD là đổi vai trò tường minh. Sửa danh tính chỉ name/email, không chèn role/banned/password. Đổi email xóa trạng thái xác minh và thu hồi session; email cũ không đăng nhập được, email mới dùng cùng credential account. Đổi vai trò/reset mật khẩu cũng thu hồi session.

Chính sách mật khẩu: 12–128 ký tự, không rỗng trắng, không trim hoặc sửa giá trị mật khẩu. Ưu tiên passphrase riêng mạnh, không bắt buộc tổ hợp ký tự tùy tiện. Better Auth băm mật khẩu. HEAD đổi mật khẩu bản thân phải xác minh mật khẩu hiện tại; thành công thu hồi tất cả session và đăng nhập lại. Reset chỉ cho người khác đã tồn tại. DEPUTY/EMPLOYEE không đổi hoặc reset mật khẩu nào. Không có thao tác xóa cứng user trong nghiệp vụ.

Mọi ghi quản trị, bootstrap và login dùng PostgreSQL advisory transaction lock key 24091802. Lấy khóa trước khi đọc lại actor/target hoặc đếm HEAD ACTIVE và giữ đến commit mutation/audit. READ COMMITTED đọc thay đổi đã commit trước đó sau khi lấy khóa; các yêu cầu cạnh tranh không cùng loại bỏ HEAD ACTIVE cuối cùng. Chỉ role=HEAD AND banned=false được đếm. Mọi điểm ghi role/banned dùng cùng khóa; route admin tổng quát vẫn đóng. Trước disable/hạ vai trò HEAD ACTIVE phải còn HEAD ACTIVE khác. Disable lưu banned=true không có hạn hết ban và thu hồi session; enable xóa metadata ban. Better Auth banUser xử lý disable người khác. Library cấm self-ban chặt hơn nghiệp vụ đã duyệt, nên self-disable dùng cập nhật ban chuẩn và xóa session trong cùng transaction, sau cùng kiểm tra HEAD cuối cùng. Giữ nguyên user và quan hệ lịch sử.

Factory auth runtime gắn adapter Drizzle vào transaction của caller. Ghi Better Auth API quản trị và audit cùng transaction PostgreSQL, không tuyên bố commit tách biệt là atomic. Login chạy handler chính thức trong transaction; hook tạo session ghi LOGIN chỉ khi email login thành công. Response handler thất bại gây rollback trước khi trả về; cookie thành công chỉ gửi sau commit. Audit lỗi rollback mutation user/session. Payload audit chỉ gồm summary danh tính/role/banned được liệt kê rõ, không mật khẩu, hash, token session hoặc metadata client tùy ý. Event: LOGIN, CREATE_USER, UPDATE_USER, CHANGE_ROLE, DISABLE_USER, ENABLE_USER, RESET_PASSWORD, CHANGE_OWN_PASSWORD. Bootstrap dùng CREATE_USER với bootstrap=true. Nền tảng này không tự suy đoán/thu thập IP hoặc user-agent.

Giữ kiểm tra Origin/CSRF mặc định Better Auth. POST auth và POST quản trị còn yêu cầu Origin khớp chính xác ứng dụng đã cấu hình; từ chối nguồn không biết/khác nguồn. Không cấu hình bỏ qua Origin. Response/lỗi client không chứa lỗi thô library/driver. Không ghi credential vào telemetry client. Ranh giới server-only runtime/session ngăn import DB/secret vào component client. Cache session React chỉ theo request, không cache phân quyền liên người dùng.

`npm run auth:bootstrap-head` là lệnh phát triển tường minh, yêu cầu KIG_BOOTSTRAP_HEAD_NAME, KIG_BOOTSTRAP_HEAD_EMAIL, KIG_BOOTSTRAP_HEAD_PASSWORD riêng tư cùng môi trường server hợp lệ và KIG_DATABASE_ENV=development. Từ chối khi đã có HEAD ACTIVE, tạo user/credential account/audit atomically dưới cùng khóa. Không in danh tính/mật khẩu/token. Không tự tạo tài khoản ban đầu vĩnh viễn: người vận hành cấp giá trị riêng tư. Bootstrap production thuộc rollout được cho phép: xác minh đích và migration, cấp input riêng tư do người vận hành chọn, duyệt chốt đích production tường minh, giữ thuật toán khóa/từ chối/audit. Lệnh phát triển không âm thầm cho production.

Test auth PostgreSQL dùng transaction rollback trên baseline tài khoản phát triển trống. Test cạnh tranh/browser dùng tài khoản namespace và mật khẩu ngẫu nhiên chỉ trong bộ nhớ, dọn audit/session/account/user thuộc fixture. Cleanup test không phải nghiệp vụ xóa cứng. Chromium dùng Origin auth local đã cấu hình, desktop/mobile; tắt trace chứa request credential. Chưa triển khai quyền/workflow Phase 3.

## Triển khai phân quyền Task Phase 3 - 2026-09-18

Phần Phase 2 ở trên là lịch sử. Giữ nghiệp vụ V1.1. Grant/policy Task tường minh tại `src/lib/tasks/policy.ts`. HEAD có tám quyền Task đã duyệt; DEPUTY có create-self/create-for-others/read-self/read-team; EMPLOYEE có create-self/read-self. Không wildcard hoặc tin actor client. Helper session/user chuẩn Phase 2 suy ra mọi actor; banned/không session nhận 401. Khóa transaction phối hợp quản trị tài khoản trước đọc actor chuẩn.

HEAD/DEPUTY đọc tất cả Task team chưa xóa; EMPLOYEE chỉ việc hiện giao cho mình. Employee creator mất quyền sau giao lại cho người khác. ID bị xóa/không đủ quyền đều trả cùng 404 không nội dung Task. Page bảo vệ session server; HEAD edit kiểm tra role trước đọc resource. Ẩn nav/control chỉ bổ trợ quyền API/service.

Tạo: HEAD giao ACTIVE user bất kỳ; DEPUTY self/ACTIVE EMPLOYEE; EMPLOYEE self. Target không tồn tại/INACTIVE/sai quyền bị từ chối, không âm thầm thay assignee. Server xác định createdById, OPEN và null thông tin vòng đời/xóa. Selector ACTIVE chỉ ID/name/role, lọc cùng ngữ nghĩa role nhưng không cấp quyền ghi. Giao lại chỉ HEAD, OPEN/chưa xóa, target ACTIVE bất kỳ; creator bất biến, Employee cũ mất quyền ngay. Giao lại cùng assignee bị từ chối như no-op.

`/api/tasks` GET danh sách/POST tạo; GET `/api/tasks/assignees` selector hợp lệ; GET `/api/tasks/[id]` chi tiết. POST `/api/tasks/[id]/metadata`, `/reassign`, `/cancel`, `/soft-delete` mỗi route gọi một command riêng. Không broad patch, HTTP hard-delete, completion/status endpoint hoặc restore. Lệnh lạ thất bại. Mutation yêu cầu Origin chính xác và response no-store; giữ bảo vệ Origin/CSRF Better Auth.

Zod strict metadata chỉ title/description/assignedDate/dueDate/priority, gửi đủ năm trường khi sửa metadata đầy đủ. Tạo thêm assignedToId; thiếu description/dueDate mặc định null, priority NORMAL. Title trim/không trắng/max 200; mô tả tùy chọn max 10.000 là giới hạn input kỹ thuật; ngày ISO thực với dueDate>=assignedDate; priority LOW/NORMAL/HIGH/URGENT; UUID cho ID. Từ chối extra creator/role/actor/status/thông tin completed/cancel/delete và assignee trong metadata edit. Reassign chỉ assignedToId; cancel/delete chỉ body command rỗng.

Chỉ HEAD sửa/giao lại/hủy/xóa mềm. Metadata/giao lại/hủy chỉ OPEN; không sửa metadata CANCELLED/COMPLETED thông thường. Hủy đặt CANCELLED/cancelledAt hiện tại/completedAt null, giữ lịch sử hiển thị. Xóa mềm độc lập status, cặp actor/time, giữ creator/status/dependency, loại khỏi mọi list/detail thường. Command ứng dụng không hard-delete. Phase 3 không đánh dấu COMPLETED; Phase 4 mới hoàn thành qua Daily Progress.

Mutation, audit before/after an toàn nghiệp vụ và thông báo cần thiết cùng transaction. Advisory lock 24091802 độc quyền trước row FOR UPDATE/kiểm tra vòng đời mới; khóa shared bảo vệ đọc/account. Hủy/giao lại hoặc xóa/sửa cạnh tranh không ghi mù theo OPEN cũ. Giao lại commit trước rồi hủy là chuỗi hợp lệ; hủy commit trước thì giao lại thất bại. PostgreSQL thật chứng minh atomicity, chờ writer và lỗi DB được tiêm. Xem phần database Phase 3 song ngữ về thông báo/fixture lịch sử/cleanup chỉ dành test.

UI: card Task mobile-first, detail/create/HEAD metadata edit bảo vệ tại `/tasks`, `/tasks/[id]`, `/tasks/new`, `/tasks/[id]/edit`; thao tác HEAD giao lại/hủy/xóa xác nhận riêng trên detail. Employee cố định self; DEPUTY không chọn HEAD/DEPUTY khác/INACTIVE. Status/priority là chữ, không chỉ màu. Giữ Quicksand/theme light/dark/system. Không UI Daily Progress/asset/Calendar/Dashboard/analytics/trung tâm thông báo.

## Phân quyền Progress Phase 4 - 2026-09-18 (V1.1)

Ranh giới Phase 3 phía trên là lịch sử. HEAD/DEPUTY/EMPLOYEE nhận progress:create-own tường minh; chỉ HEAD progress:correct. Mọi command suy ra actor ACTIVE chuẩn sau advisory coordination; gửi thường còn yêu cầu current assignee, OPEN, parent chưa xóa. HEAD không báo thay người khác. Đọc thừa kế resource policy Task; Employee cũ mất quyền history sau giao lại, ID đã xóa/không đủ quyền không lộ nội dung. HEAD correction chỉ mới nhất/đổi trạng thái, đủ lý do hành chính/audit; không đảo ngược hủy. Xem database song ngữ và bảo vệ nghiệp vụ về chronology/hệ quả báo cáo cùng ngày.

GET `/api/tasks/[id]/progress` trả history an toàn đã kiểm tra quyền, today nghiệp vụ suy ra và eligibility UI do server quyết định. POST cùng path gửi payload strict theo status. POST `/api/tasks/[id]/progress/[progressId]/correct` là correction HEAD-only strict riêng. Không generic PATCH/DELETE progress hay endpoint task status/reopen. Mutation yêu cầu Origin chính xác, response no-store, lỗi 401/403/404/409 có kiểm soát và input 400; lỗi driver/library bất ngờ trả 503 tổng quát, không log credential. Giữ bảo vệ Better Auth. Giới hạn input kỹ thuật 5.000 ký tự cho cả lý do chưa hoàn thành và correction. UI dùng shadcn Dialog quản lý focus, scroll mobile; báo cáo thường tách rõ correction hành chính HEAD. Không asset/calendar/dashboard/report/trung tâm thông báo.
