# Sẵn sàng sản xuất — Phiên bản 1.1

## Runtime và môi trường đích

Dùng Node 24, npm với lockfile đã commit, dịch vụ Node của Railway và Neon PostgreSQL. Build bằng `npm ci && npm run build`, chạy bằng `npm start`; Railway cung cấp `PORT`. Dùng `/api/health` làm đường dẫn readiness. Production bắt buộc HTTPS.

## Hợp đồng biến môi trường

Các giá trị chỉ dùng phía máy chủ: `DATABASE_URL`, `BETTER_AUTH_SECRET` ngẫu nhiên riêng biệt tối thiểu 32 ký tự, `BETTER_AUTH_URL` HTTPS và `KIG_DATABASE_ENV=production` rõ ràng. Không dùng placeholder. Drive dùng `GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY` và, với mô hình My Drive của KIG, `GOOGLE_DRIVE_ALLOWED_FOLDER_ID`. `GOOGLE_DRIVE_SHARED_DRIVE_ID` là tùy chọn và chỉ đại diện Shared Drive. Không thêm tiền tố `NEXT_PUBLIC_`.

Chủ sở hữu tạo thư mục **KIG Marketing CRM** riêng trong My Drive và cấp quyền Viewer cho service account. Ứng dụng giữ scope `drive.metadata.readonly` và không ghi vào Drive. Quan hệ thư mục cho phép được kiểm tra bằng duyệt metadata có giới hạn và chống chu kỳ. Phase 9 phải xác minh folder ID production.

## Cơ sở dữ liệu và migration

`npm run db:bootstrap` chỉ dành cho development và từ chối database không rỗng. `npm run db:migrate` chỉ áp dụng migration đã commit nhưng chưa áp dụng và vẫn bị chặn ở development trong Phase 8. Migration production ở Phase 9 cần người vận hành được ủy quyền, xác minh đích, xác nhận backup/PITR Neon, review migration và quyết định forward-fix/rollback. Không chạy integration test, fixture, bootstrap, Studio hoặc lệnh phá hủy trên production.

## Checklist triển khai

Trước deploy: kiểm tra riêng tư toàn bộ biến môi trường; xác nhận backup/PITR Neon và người chịu trách nhiệm khôi phục; xoay credential bị lộ; chạy toàn bộ quality gate; xác nhận không drift và Git sạch; kiểm tra service account Viewer và thư mục cho phép. Sau deploy: kiểm tra `/api/health`, redirect root/login/protected, auth, cách ly role, metadata Drive, CSP/header, log và mobile. Khi lỗi, rollback bản phát hành ứng dụng; không xóa hoặc restore database khi chưa có kế hoạch được phê duyệt.

Xoay credential: chỉ thay Better Auth secret với kế hoạch hủy session; tạo key service account mới trong Google Cloud, cập nhật secret store, restart và xác minh trước khi thu hồi key cũ. Nếu key bị lộ, thu hồi ngay, kiểm tra access log, xoay secret liên quan và ghi nhận sự cố. Không commit credential.

Restore drill cô lập có thể hoàn tất ở Phase 9; tuyệt đối không dùng database development dùng chung hoặc production làm đích.
