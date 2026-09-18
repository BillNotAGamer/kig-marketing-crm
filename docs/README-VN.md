# KIG MARKETING CRM

## Đặc tả nghiệp vụ nền tảng — Version 1.1

**Dự án:** KIG Marketing CRM
**Thư mục dự án:** `F:\Coding\Web development\KIG Marketing CRM`
**Ngôn ngữ tài liệu:** Tiếng Việt
**Phiên bản:** 1.1 (Version 1.1)
**Trạng thái:** Baseline đã chốt

---

# 1. Mục tiêu hệ thống

KIG Marketing CRM là hệ thống nội bộ phục vụ việc quản lý công việc hằng ngày của team Marketing thuộc KIG Holding.

Mục tiêu chính:

- Trưởng phòng và Phó phòng có thể giao công việc cho nhân viên.
- Nhân viên theo dõi danh sách công việc được giao theo ngày.
- Nhân viên cập nhật trạng thái hoàn thành hoặc chưa hoàn thành.
- Khi chưa hoàn thành, nhân viên bắt buộc phải cung cấp lý do.
- Trưởng phòng có thể theo dõi tiến độ của toàn bộ team.
- Hệ thống duy trì lịch sử công việc và lịch sử thay đổi để phục vụ quản lý.
- Giao diện phải tối ưu mạnh cho thiết bị di động.
- Lịch công việc là giao diện trung tâm của hệ thống.

KIG Marketing CRM là hệ thống nội bộ, không phải hệ thống CRM bán hàng và không có cơ chế đăng ký tài khoản công khai.

---

# 2. Công nghệ nền tảng

Kiến trúc V1 sử dụng mô hình Next.js full-stack monolith.

Stack chính:

- Next.js
- React
- TypeScript
- PostgreSQL
- Neon
- Drizzle ORM
- Better Auth
- Zod
- React Hook Form
- Tailwind CSS
- shadcn/ui
- next-themes
- Lucide Icons
- Railway
- Git/GitHub

Timezone nghiệp vụ chính thức:

`Asia/Ho_Chi_Minh`

Font giao diện chính:

`Quicksand, sans-serif`

---

# 3. Vai trò người dùng

Hệ thống có ba role chính.

## 3.1 HEAD — Trưởng phòng

HEAD là quyền quản trị cao nhất của hệ thống.

HEAD có quyền:

- Quản lý toàn bộ user.
- Tạo tài khoản.
- Chỉnh sửa thông tin tài khoản.
- Thay đổi role.
- Kích hoạt hoặc vô hiệu hóa tài khoản.
- Đặt lại mật khẩu cho user.
- Thay đổi mật khẩu tài khoản HEAD.
- Xem toàn bộ task.
- Tạo task.
- Giao task.
- Chỉnh sửa task.
- Chuyển người thực hiện task.
- Hủy task.
- Xóa task.
- Xem toàn bộ báo cáo.
- Xem audit log.
- Theo dõi tiến độ toàn team.

HEAD tương đương với administrator của ứng dụng.

---

# 4. DEPUTY — Phó phòng

DEPUTY là role quản lý công việc nhưng không phải administrator hệ thống.

DEPUTY có quyền:

- Xem công việc của toàn team.
- Xem dashboard tiến độ team.
- Tạo task.
- Giao task cho nhân viên.
- Tạo task cho chính mình.
- Cập nhật tiến độ các task được giao cho chính mình.
- Xem báo cáo công việc.

DEPUTY không được:

- Tạo user.
- Xóa hoặc vô hiệu hóa user.
- Thay đổi role.
- Đặt lại mật khẩu user.
- Thay đổi mật khẩu của chính mình.
- Chỉnh sửa task sau khi task đã được tạo.
- Xóa task.
- Reassign task đã tồn tại.
- Chỉnh sửa báo cáo tiến độ của người khác.

Nếu trong tương lai cần cho DEPUTY chỉnh sửa task do chính mình tạo, đây phải được coi là một thay đổi nghiệp vụ và tài liệu này phải được cập nhật trước hoặc đồng thời với code.

---

# 5. EMPLOYEE — Nhân viên

EMPLOYEE là người thực hiện công việc.

EMPLOYEE có quyền:

- Xem các task được giao cho mình.
- Xem task do mình tự tạo.
- Tạo task cho chính mình.
- Cập nhật tiến độ task của chính mình.
- Đánh dấu hoàn thành.
- Báo chưa hoàn thành.
- Nhập lý do khi chưa hoàn thành.
- Xem lịch sử công việc của bản thân.

EMPLOYEE không được:

- Xem task riêng của nhân viên khác.
- Giao task cho người khác.
- Sửa nội dung task sau khi task đã được tạo.
- Xóa task.
- Reassign task.
- Quản lý user.
- Thay đổi role.
- Tự thay đổi mật khẩu.
- Thay đổi báo cáo tiến độ của người khác.

---

# 6. Permission Matrix

| Chức năng                         |     HEAD     | DEPUTY | EMPLOYEE |
| --------------------------------- | :----------: | :----: | :------: |
| Đăng nhập                         |      ✅      |   ✅   |    ✅    |
| Tự đăng ký tài khoản              |      ❌      |   ❌   |    ❌    |
| Xem task của mình                 |      ✅      |   ✅   |    ✅    |
| Xem task toàn team                |      ✅      |   ✅   |    ❌    |
| Tạo task cho mình                 |      ✅      |   ✅   |    ✅    |
| Giao task cho người khác          |      ✅      |   ✅   |    ❌    |
| Chỉnh sửa task đã tạo             |      ✅      |   ❌   |    ❌    |
| Reassign task                     |      ✅      |   ❌   |    ❌    |
| Hủy task                          |      ✅      |   ❌   |    ❌    |
| Xóa task                          |      ✅      |   ❌   |    ❌    |
| Báo hoàn thành task của mình      |      ✅      |   ✅   |    ✅    |
| Báo chưa hoàn thành task của mình |      ✅      |   ✅   |    ✅    |
| Nhập lý do chưa hoàn thành        |      ✅      |   ✅   |    ✅    |
| Thay đổi tiến độ của người khác   |      ❌      |   ❌   |    ❌    |
| Xem dashboard toàn team           |      ✅      |   ✅   |    ❌    |
| Xem dashboard cá nhân             |      ✅      |   ✅   |    ✅    |
| Xem báo cáo toàn team             |      ✅      |   ✅   |    ❌    |
| Tạo user                          |      ✅      |   ❌   |    ❌    |
| Sửa user                          |      ✅      |   ❌   |    ❌    |
| Disable user                      |      ✅      |   ❌   |    ❌    |
| Thay đổi role                     |      ✅      |   ❌   |    ❌    |
| Reset password user               |      ✅      |   ❌   |    ❌    |
| Tự thay đổi password              | ✅ HEAD only |   ❌   |    ❌    |
| Xem Audit Log toàn hệ thống       |      ✅      |   ❌   |    ❌    |

---

# 7. Quy tắc quản lý tài khoản

Hệ thống không có public registration.

Không tồn tại nghiệp vụ:

`Sign Up`

Tất cả tài khoản phải được HEAD tạo.

Luồng:

HEAD
→ User Management
→ Create User
→ nhập thông tin
→ chọn role
→ cấp mật khẩu
→ User đăng nhập

User DEPUTY và EMPLOYEE không được tự thay đổi mật khẩu.

Nếu mất mật khẩu:

User
→ liên hệ HEAD
→ HEAD reset password.

---

# 8. Quy tắc xóa tài khoản

User không được hard delete khỏi database trong hoạt động thông thường.

Thao tác "Xóa nhân viên" trên giao diện thực chất là:

`Deactivate / Disable User`

User có thể có trạng thái:

- ACTIVE
- INACTIVE

INACTIVE:

- Không được đăng nhập.
- Không được nhận task mới.
- Không xuất hiện trong danh sách assignee mặc định.
- Task lịch sử vẫn được giữ.
- Task update vẫn được giữ.
- Audit log vẫn được giữ.
- Báo cáo lịch sử vẫn chính xác.

Hệ thống phải luôn tồn tại ít nhất một HEAD đang ACTIVE.

Không được:

- Disable HEAD cuối cùng.
- Demote HEAD cuối cùng sang role khác.

---

# 9. Mô hình Task

Một Task tối thiểu phải chứa các thông tin nghiệp vụ sau:

- ID
- Tiêu đề
- Nội dung / mô tả
- Người tạo
- Người thực hiện
- Ngày giao
- Hạn hoàn thành nếu có
- Priority
- Status
- Thời gian tạo
- Thời gian cập nhật
- Thời gian hoàn thành
- Thời gian xóa mềm nếu có

Các trường ownership quan trọng:

`createdById`

và:

`assignedToId`

phải độc lập với nhau.

`createdById` không được thay đổi khi HEAD chỉnh sửa task.

Ví dụ:

Nhân viên A tạo task
→ `createdById = A`

Sau đó HEAD chỉnh sửa task
→ `createdById` vẫn phải là A.

---

# 10. Task Priority

V1 sử dụng bốn mức độ ưu tiên:

- LOW — Thấp
- NORMAL — Bình thường
- HIGH — Cao
- URGENT — Khẩn cấp

Mặc định:

`NORMAL`

---

# 11. Task Lifecycle

Task sử dụng ba trạng thái chính:

## OPEN

Task đang cần thực hiện.

## COMPLETED

Task đã hoàn thành.

## CANCELLED

Task đã bị HEAD hủy và không còn yêu cầu thực hiện.

Luồng cơ bản:

`OPEN → COMPLETED`

hoặc:

`OPEN → CANCELLED`

Task không tự chuyển sang COMPLETED.

Task cũng không tự chuyển sang CANCELLED.

---

# 12. Daily Progress

Task status và Daily Progress là hai khái niệm khác nhau.

Task status thể hiện vòng đời tổng thể của task.

Daily Progress thể hiện báo cáo của người thực hiện vào từng ngày.

Daily Progress có hai trạng thái được lưu:

- COMPLETED
- NOT_COMPLETED

Ngoài ra giao diện có trạng thái suy diễn:

- NOT_REPORTED — Chưa cập nhật

NOT_REPORTED không nhất thiết phải lưu thành record database.

Nếu tại ngày cần kiểm tra không có Task Update tương ứng thì UI coi task là:

`Chưa cập nhật`

---

# 13. Quy tắc COMPLETED

Khi assignee chọn:

`Hoàn thành`

hệ thống phải:

1. Tạo Daily Progress tương ứng.
2. Đặt progress = COMPLETED.
3. Chuyển Task từ OPEN sang COMPLETED.
4. Ghi `completedAt`.
5. Ghi audit log.

Sau khi task đã COMPLETED, EMPLOYEE hoặc DEPUTY không được tự sửa nội dung task hoặc mở lại task.

Nếu cần sửa do thao tác nhầm, HEAD xử lý.

---

# 14. Quy tắc NOT_COMPLETED

Khi assignee chọn:

`Chưa hoàn thành`

hệ thống bắt buộc yêu cầu:

`reason`

Reason không được rỗng.

Ví dụ:

"Chưa nhận được footage từ team Media."

Hệ thống:

1. Tạo Daily Progress.
2. Đặt progress = NOT_COMPLETED.
3. Lưu reason.
4. Giữ Task ở trạng thái OPEN.
5. Ghi audit log.

Task tiếp tục xuất hiện trong danh sách công việc chưa hoàn thành.

---

# 15. Task kéo dài qua nhiều ngày

V1 không tự động clone task sang ngày tiếp theo.

Ví dụ:

Task được giao ngày 18/09.

Ngày 18/09:

`NOT_COMPLETED`

Task vẫn giữ nguyên ID và trạng thái OPEN.

Ngày 19/09:

Task tiếp tục xuất hiện trong danh sách unfinished/overdue của người thực hiện.

Người thực hiện có thể cập nhật tiến độ mới cho ngày 19/09.

Nhờ vậy lịch sử có thể là:

18/09
NOT_COMPLETED
"Chờ footage"

19/09
COMPLETED

Task chỉ tồn tại một lần nhưng có nhiều Daily Progress records.

---

# 16. Task do nhân viên tự tạo

EMPLOYEE được phép tự tạo task.

Khi đó:

`createdById = currentUser.id`

và:

`assignedToId = currentUser.id`

EMPLOYEE không được chọn assignee khác.

Sau khi task được tạo:

EMPLOYEE không được chỉnh sửa nội dung task.

HEAD vẫn có quyền quản trị task đó.

UI phải thể hiện được task là task tự tạo.

Điều này có thể được suy luận từ:

`createdById === assignedToId`

hoặc triển khai thêm metadata phù hợp nếu sau này cần.

---

# 17. Quy tắc giao Task

HEAD:

- Có thể giao task cho user đang ACTIVE.
- Có thể giao task cho chính mình.
- Có thể thay đổi assignee của task.

DEPUTY:

- Có thể giao task cho EMPLOYEE đang ACTIVE.
- Có thể tạo task cho chính mình.
- Không được giao task cho HEAD.
- Không được thay đổi assignee sau khi task đã được tạo.

EMPLOYEE:

- Chỉ có thể tạo task cho chính mình.

---

# 18. Quy tắc chỉnh sửa Task

HEAD có quyền chỉnh sửa:

- title
- description
- assigned date
- due date
- priority
- assignee
- các metadata quản trị phù hợp

HEAD không được làm thay đổi:

`createdById`

trừ trường hợp sửa dữ liệu trực tiếp ở cấp kỹ thuật bởi migration hoặc quy trình recovery được kiểm soát.

DEPUTY không được chỉnh sửa task sau khi đã tạo.

EMPLOYEE không được chỉnh sửa task sau khi đã tạo.

---

# 19. Quy tắc Delete Task

HEAD có quyền "xóa" task.

V1 sử dụng soft delete.

Ví dụ:

`deletedAt != null`

Không hard delete task trong nghiệp vụ bình thường.

Task bị soft delete:

- Không hiển thị trong màn hình làm việc mặc định.
- Không tính vào thống kê hiện tại.
- Lịch sử audit vẫn được giữ.
- Có thể được phục hồi trong tương lai nếu chức năng restore được triển khai.

---

# 20. CANCELLED khác DELETE

CANCELLED là trạng thái nghiệp vụ.

Ví dụ:

"Sự kiện đã bị hủy nên không cần làm banner nữa."

Task vẫn tồn tại và được nhìn thấy trong lịch sử.

DELETE là thao tác quản trị nhằm ẩn/remove record khỏi hoạt động thông thường.

Hai hành vi này không được coi là giống nhau.

---

# 21. Audit Log

Audit log là yêu cầu bắt buộc từ V1.

Các event quan trọng phải được ghi lại, ví dụ:

- LOGIN
- CREATE_USER
- UPDATE_USER
- DISABLE_USER
- CHANGE_ROLE
- RESET_PASSWORD
- CREATE_TASK
- UPDATE_TASK
- REASSIGN_TASK
- CANCEL_TASK
- DELETE_TASK
- MARK_TASK_COMPLETED
- MARK_TASK_NOT_COMPLETED

Audit tối thiểu cần biết:

- Ai thực hiện.
- Thực hiện hành động gì.
- Đối tượng nào bị tác động.
- Thời điểm.
- Dữ liệu quan trọng trước/sau nếu phù hợp.

---

# 22. Calendar Business Rules

Calendar là giao diện chính cho quản lý task.

Desktop ưu tiên:

- Month view.
- Week view.
- Daily detail.

Mobile ưu tiên:

- Date selector.
- Daily agenda.
- Task cards.
- Bottom navigation.

Không ép giao diện calendar desktop thu nhỏ trực tiếp xuống mobile.

---

# 23. Dashboard

## HEAD

Dashboard có thể hiển thị:

- Tổng task hôm nay.
- Đã hoàn thành.
- Chưa hoàn thành.
- Chưa cập nhật.
- Tỷ lệ hoàn thành.
- Tiến độ từng nhân viên.
- Task quá hạn.

## DEPUTY

Được xem dashboard team.

Không có quyền quản trị user thông qua dashboard.

## EMPLOYEE

Dashboard tập trung vào:

- Công việc hôm nay.
- Số task đã hoàn thành.
- Số task chưa hoàn thành.
- Số task chưa cập nhật.
- Task quá hạn của bản thân.

---

# 24. Theme và Mobile

Hệ thống hỗ trợ:

- Light
- Dark
- System

Mobile-first là yêu cầu bắt buộc.

Mọi màn hình chính phải được kiểm tra tối thiểu ở:

- Mobile.
- Tablet.
- Desktop.

Không được coi desktop responsive thu nhỏ là đủ cho UX mobile.

---

# 25. Notification

V1 ưu tiên in-app notification.

Ví dụ:

"Trưởng phòng vừa giao cho bạn task Thiết kế banner Facebook."

Các integration như:

- Email
- Telegram
- Zalo
- Push Notification

không thuộc phạm vi bắt buộc của V1.

---

# 26. Các invariant quan trọng

Những quy tắc sau không được vi phạm ở bất kỳ tầng nào của hệ thống.

### INV-01

`createdById` của task không được tự động thay đổi khi task được chỉnh sửa.

### INV-02

Chỉ HEAD được quản trị user.

### INV-03

DEPUTY và EMPLOYEE không được tự thay đổi mật khẩu.

### INV-04

EMPLOYEE không được giao task cho người khác.

### INV-05

NOT_COMPLETED bắt buộc phải có reason.

### INV-06

Chỉ assignee được cập nhật progress cho task của mình.

### INV-07

Task COMPLETED không được EMPLOYEE/DEPUTY tự mở lại.

### INV-08

User INACTIVE không được đăng nhập hoặc nhận task mới.

### INV-09

Không được disable hoặc demote HEAD cuối cùng.

### INV-10

Delete user và delete task sử dụng soft-delete/deactivation trong nghiệp vụ bình thường.

### INV-11

Mọi operation đặc quyền phải kiểm tra permission ở backend.

Không được chỉ dựa vào việc ẩn button trên UI.

### INV-12

Timezone nghiệp vụ là `Asia/Ho_Chi_Minh`.

---

# 27. Source of Truth

Các tài liệu nghiệp vụ tiếng Việt trong thư mục `docs/` là source of truth chính thức của dự án.

Code không được coi là tài liệu nghiệp vụ duy nhất.

Nếu code và tài liệu mâu thuẫn:

1. Phải xác minh business rule chính xác.
2. Cập nhật tài liệu.
3. Cập nhật implementation.
4. Cập nhật test.
5. Không để sự khác biệt tồn tại có chủ ý mà không được document.

---

# 28. Quy tắc cập nhật tài liệu

Bất kỳ thay đổi nào liên quan đến các nội dung sau đều phải cập nhật tài liệu:

- Role.
- Permission.
- Task lifecycle.
- Daily progress.
- User lifecycle.
- Authentication.
- Password policy.
- Ownership.
- Audit rules.
- Database relationship có ý nghĩa nghiệp vụ.
- Workflow.
- Quy tắc hiển thị hoặc thống kê có ảnh hưởng business logic.

Một thay đổi nghiệp vụ không được coi là hoàn thành nếu chỉ thay đổi code mà không cập nhật tài liệu tương ứng.

---

# 29. Change Log

Mỗi thay đổi nghiệp vụ quan trọng phải được ghi lại trong tài liệu changelog.

Format khuyến nghị:

```text
Ngày:
Phiên bản:
Thay đổi:
Lý do:
Ảnh hưởng:
Tài liệu liên quan:
Migration:
Tests:
```

Ví dụ:

```text
Ngày: 2026-10-12
Phiên bản: 1.1
Thay đổi:
Cho phép DEPUTY chỉnh sửa task do chính mình tạo.

Ảnh hưởng:
Permission Matrix
Task Update Policy
RBAC tests
API authorization
UI controls
```

---

# 30. Phạm vi V1 đã chốt

V1 bao gồm:

1. Authentication.
2. RBAC.
3. HEAD / DEPUTY / EMPLOYEE.
4. User Management.
5. Task Management.
6. Self-created Task.
7. Daily Progress.
8. Completed / Not Completed / Not Reported.
9. Reason khi chưa hoàn thành.
10. Calendar.
11. Dashboard.
12. Audit Log.
13. In-app Notification cơ bản.
14. Search / Filter cơ bản.
15. Light / Dark theme.
16. Mobile-first UI.
17. Soft-delete / User deactivation.

Các chức năng ngoài scope V1:

- AI.
- CRM sales.
- Customer management.
- Multi-tenant.
- Microservices.
- Real-time collaborative editing.
- Redis.
- Kafka.
- External email automation.
- Zalo integration.
- Telegram integration.
- Marketing campaign analytics nâng cao.

---

# 31. Trạng thái quyết định

Các Business Requirements, Permission Matrix và Task Lifecycle trong tài liệu này được xem là:

**APPROVED BASELINE — V1.1**

Mọi thiết kế database, architecture, API, UI và automated test tiếp theo phải căn cứ trên baseline này.

# 32. Bổ sung nghiệp vụ V1.1 — Google Drive Task Assets / Deliverables

Baseline V1.0 đã thiết lập được giữ nguyên; Version 1.1 bổ sung tài nguyên/kết quả bàn giao và các bảo vệ kỹ thuật đã phê duyệt. Các chức năng V1 là phạm vi các phase sau, chưa triển khai ở Phase 0.

Asset là resource độc lập với nội dung/ownership task; thêm/gỡ không cấp quyền sửa metadata. Provider V1: GOOGLE_DRIVE. Loại: IMAGE, VIDEO, DOCUMENT, SPREADSHEET, PRESENTATION, PDF, OTHER. Backend xác thực/chuẩn hóa supported Google Drive/Docs domains cần thiết đã duyệt, không iframe URL tùy ý. Lưu providerFileId/sourceUrl và fileName/mimeType/assetType khi có; không lưu thumbnail hết hạn làm dữ liệu lâu dài. Không gắn cùng file active hai lần/task; có thể gắn lại sau soft removal.

| Hành động  | HEAD                      | DEPUTY                                                        | EMPLOYEE                                                      |
| ---------- | ------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------- |
| Xem asset  | Task toàn team chưa xóa   | Task toàn team chưa xóa                                       | Task hiện giao cho mình chưa xóa                              |
| Thêm asset | Bất kỳ task chưa xóa      | Task OPEN chưa xóa hiện giao cho mình                         | Task OPEN chưa xóa hiện giao cho mình                         |
| Gỡ asset   | Bất kỳ association active | Asset do mình thêm trên task OPEN chưa xóa hiện giao cho mình | Asset do mình thêm trên task OPEN chưa xóa hiện giao cho mình |

DEPUTY tạo task cho EMPLOYEE không có quyền thêm deliverable vào task đó chỉ vì là creator. Asset đã soft-delete bị loại khỏi đọc thông thường. Gỡ chỉ đặt deletedAt/deletedById trên CRM association và audit; không xóa/sửa file nguồn Drive.

Preview chỉ nội dung Drive đã xác thực. Thiếu quyền/file mất/không hỗ trợ/mạng/API lỗi vẫn giữ Task Detail hoạt động, thông báo không xem trước được và lựa chọn mở Google Drive. Quyền CRM không tự cấp quyền Drive. Credentials/API/preview thuộc phase tích hợp, không Phase 0.

# 33. Bảo vệ kỹ thuật V1.1

Better Auth sở hữu user/session/account/verification; application sở hữu task/task_daily_update/task_asset/notification/audit_log. UUID cho ID và user foreign keys. Phase 1 cấu hình advanced.database.generateId = "uuid", sinh auth schema bằng CLI từ cấu hình thực tế; không tự dựng lại schema nội bộ.

Một user có đúng một role HEAD/DEPUTY/EMPLOYEE (mặc định EMPLOYEE); từ chối role rỗng/lạ/nhiều role. HEAD đầu tiên khởi tạo quản trị có kiểm soát. Luồng tạo user thông thường DEPUTY/EMPLOYEE; promote HEAD là thao tác riêng. DEPUTY giao cho bản thân hoặc ACTIVE EMPLOYEE, không giao DEPUTY khác.

ACTIVE = banned=false; INACTIVE = banned=true. Không thêm isActive/userStatus/deletedAt để biểu diễn cùng trạng thái. Chỉ HEAD quản lý user/mật khẩu. Không cấp user hard-delete/impersonation; endpoint generic identity/self-update/reset/change-password không được bypass policy. HEAD đổi mật khẩu mình hoặc reset người khác. Bảo vệ HEAD ACTIVE cuối bằng transaction/concurrency.

Daily Progress UNIQUE(taskId, reportDate), SQL UNIQUE(task_id, report_date): một bản ghi chính thức/task/ngày. Server xác định reportDate theo Asia/Ho_Chi_Minh, client không gửi ngày tùy ý. Ordinary users không sửa/xóa sau gửi. COMPLETED reason NULL; NOT_COMPLETED reason khác NULL và trim khác rỗng.

Ma trận mục 6 cấm báo cáo/sửa tiến độ thông thường thay người khác. HEAD có ngoại lệ correction hành chính được cấp quyền riêng, không phải báo cáo thay assignee: correctedAt/correctedById/correctionReason bắt buộc, audit before/after đầy đủ và lifecycle parent đổi atomically. Sửa NOT_COMPLETED → OPEN/completedAt NULL; sửa COMPLETED → COMPLETED/completedAt thời điểm correction. Giữ một row/task/ngày.

DATE (assignedDate/dueDate/reportDate) là ngày lịch địa phương; TIMESTAMPTZ là instant sự kiện. Không cắt UTC thành ngày nghiệp vụ. Metadata update không nhận creator/status/lifecycle/deletion fields. HEAD reassign/cancel chỉ OPEN chưa xóa, target reassign ACTIVE. Audit append-only. Notification được lưu, không yêu cầu WebSocket. Audit V1.1 thêm ADD_TASK_ASSET/REMOVE_TASK_ASSET/CORRECT_TASK_PROGRESS cùng các event kỹ thuật đã duyệt.

Node 24 LTS (>=24 <25), Next.js full-stack monolith, PostgreSQL/Neon + Drizzle stable; Railway Node.js service dùng Postgres.js transactional connection, không Neon HTTP single-query. Phase 0 không DB/schema/migration/deploy.

- INV-13: Asset độc lập với metadata/ownership task.
- INV-14: DEPUTY/EMPLOYEE chỉ thêm thông thường vào task OPEN hiện giao mình.
- INV-15: Chỉ approved provider/validated URL được nhúng/preview, V1 Google Drive.
- INV-16: Preview lỗi không làm Task mất khả dụng.
- INV-17: Gỡ CRM asset không xóa/sửa file Drive nguồn.
- INV-18: Tối đa một Daily Progress/task/ngày nghiệp vụ.
- INV-19: Ordinary progress bất biến; HEAD corrections riêng có audit.
- INV-20: UUID user ID/foreign keys theo Better Auth PostgreSQL đã duyệt.

Business change phải cập nhật CẢ tiếng Anh/Việt và tests. Agent phải báo cáo code/docs discrepancy thay vì âm thầm chọn một bên.

[Database](04-DATABASE-DESIGN-VN.md) · [Authorization](05-AUTHORIZATION-MODEL-VN.md) · [English](README.md) · [Changelog](CHANGELOG.md).
