export function isRouteActive(pathname: string, href: string): boolean {
  if (href === "/app" || href === "/dashboard") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function getPageTitle(pathname: string): string {
  if (pathname === "/app") return "Hôm nay";
  if (pathname === "/dashboard") return "Tổng quan";
  if (pathname.startsWith("/tasks/new")) return "Tạo công việc mới";
  if (pathname.startsWith("/tasks") && pathname.includes("/edit"))
    return "Chỉnh sửa công việc";
  if (pathname.startsWith("/tasks")) return "Công việc";
  if (pathname.startsWith("/calendar")) return "Lịch";
  if (pathname.startsWith("/reports")) return "Báo cáo";
  if (pathname.startsWith("/search")) return "Tìm kiếm";
  if (pathname.startsWith("/audit")) return "Nhật ký hệ thống";
  if (pathname.startsWith("/users")) return "Quản lý người dùng";
  if (pathname.startsWith("/account/password")) return "Đổi mật khẩu";
  if (pathname.startsWith("/notifications")) return "Thông báo";
  if (pathname.startsWith("/access-denied")) return "Từ chối truy cập";
  return "KIG Marketing CRM";
}
