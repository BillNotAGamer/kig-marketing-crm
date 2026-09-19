import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { isRouteActive, getPageTitle } from "./nav-utils";
import { DesktopSidebar } from "./desktop-sidebar";
import { MobileBottomNav } from "./mobile-nav";
import type { Actor } from "@/lib/auth/session-core";

let mockPathname = "/dashboard";

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({
    theme: "system",
    setTheme: vi.fn(),
  }),
}));

const headActor: Actor = {
  id: "head-1",
  name: "Nguyễn Văn Head",
  email: "head@kigholding.vn",
  role: "HEAD",
};

const deputyActor: Actor = {
  id: "deputy-1",
  name: "Trần Thị Deputy",
  email: "deputy@kigholding.vn",
  role: "DEPUTY",
};

const employeeActor: Actor = {
  id: "emp-1",
  name: "Lê Văn Employee",
  email: "emp@kigholding.vn",
  role: "EMPLOYEE",
};

describe("Navigation Utilities", () => {
  describe("isRouteActive", () => {
    it("matches exact paths for root app and dashboard", () => {
      expect(isRouteActive("/app", "/app")).toBe(true);
      expect(isRouteActive("/app/sub", "/app")).toBe(false);
      expect(isRouteActive("/dashboard", "/dashboard")).toBe(true);
      expect(isRouteActive("/dashboard/sub", "/dashboard")).toBe(false);
    });

    it("matches subroutes for tasks", () => {
      expect(isRouteActive("/tasks", "/tasks")).toBe(true);
      expect(isRouteActive("/tasks/new", "/tasks")).toBe(true);
      expect(isRouteActive("/tasks/task-123", "/tasks")).toBe(true);
      expect(isRouteActive("/tasks/task-123/edit", "/tasks")).toBe(true);
      expect(isRouteActive("/tasks-fake", "/tasks")).toBe(false);
    });

    it("matches subroutes for other pages", () => {
      expect(isRouteActive("/calendar", "/calendar")).toBe(true);
      expect(isRouteActive("/reports", "/reports")).toBe(true);
      expect(isRouteActive("/search", "/search")).toBe(true);
      expect(isRouteActive("/audit", "/audit")).toBe(true);
      expect(isRouteActive("/users", "/users")).toBe(true);
      expect(isRouteActive("/users/123", "/users")).toBe(true);
    });
  });

  describe("getPageTitle", () => {
    it("returns correct Vietnamese page titles", () => {
      expect(getPageTitle("/app")).toBe("Hôm nay");
      expect(getPageTitle("/dashboard")).toBe("Tổng quan");
      expect(getPageTitle("/tasks")).toBe("Công việc");
      expect(getPageTitle("/tasks/new")).toBe("Tạo công việc mới");
      expect(getPageTitle("/tasks/123/edit")).toBe("Chỉnh sửa công việc");
      expect(getPageTitle("/calendar")).toBe("Lịch");
      expect(getPageTitle("/reports")).toBe("Báo cáo");
      expect(getPageTitle("/search")).toBe("Tìm kiếm");
      expect(getPageTitle("/audit")).toBe("Nhật ký hệ thống");
      expect(getPageTitle("/users")).toBe("Quản lý người dùng");
      expect(getPageTitle("/account/password")).toBe("Đổi mật khẩu");
      expect(getPageTitle("/notifications")).toBe("Thông báo");
      expect(getPageTitle("/access-denied")).toBe("Từ chối truy cập");
      expect(getPageTitle("/unknown-page")).toBe("KIG Marketing CRM");
    });
  });
});

describe("DesktopSidebar Component", () => {
  beforeEach(() => {
    mockPathname = "/dashboard";
  });

  it("renders branding without development foundation or debug text", () => {
    render(<DesktopSidebar actor={headActor} />);
    expect(screen.getByText("KIG Marketing CRM")).toBeInTheDocument();
    expect(screen.getByText("Marketing Workspace")).toBeInTheDocument();
    expect(screen.queryByText(/foundation/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Phase 0/i)).not.toBeInTheDocument();
  });

  it("renders operational links and admin links for HEAD role", () => {
    render(<DesktopSidebar actor={headActor} />);

    // Operational items
    expect(screen.getByRole("link", { name: /Hôm nay/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Tổng quan/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Công việc/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Lịch/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Báo cáo/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Tìm kiếm/ })).toBeInTheDocument();

    // Admin items
    expect(
      screen.getByRole("link", { name: /Nhật ký hệ thống/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Quản lý người dùng/ }),
    ).toBeInTheDocument();

    // Account items
    expect(screen.getByText("Nguyễn Văn Head")).toBeInTheDocument();
    expect(screen.getByText("HEAD")).toBeInTheDocument();
    expect(screen.queryByText("head@kigholding.vn")).not.toBeInTheDocument(); // Email omitted in sidebar
    expect(
      screen.getByRole("link", { name: /Đổi mật khẩu/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Đăng xuất/ }),
    ).toBeInTheDocument();
  });

  it("hides admin links for DEPUTY role", () => {
    render(<DesktopSidebar actor={deputyActor} />);

    expect(screen.getByRole("link", { name: /Hôm nay/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Công việc/ })).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Nhật ký hệ thống/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Quản lý người dùng/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Trần Thị Deputy")).toBeInTheDocument();
    expect(screen.getByText("DEPUTY")).toBeInTheDocument();
  });

  it("hides admin links for EMPLOYEE role", () => {
    render(<DesktopSidebar actor={employeeActor} />);

    expect(screen.getByRole("link", { name: /Hôm nay/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Công việc/ })).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Nhật ký hệ thống/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Quản lý người dùng/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Lê Văn Employee")).toBeInTheDocument();
    expect(screen.getByText("EMPLOYEE")).toBeInTheDocument();
  });

  it("applies aria-current='page' to active item and task subroutes", () => {
    mockPathname = "/tasks/task-999/edit";
    render(<DesktopSidebar actor={headActor} />);

    const tasksLink = screen.getByRole("link", { name: /Công việc/ });
    expect(tasksLink).toHaveAttribute("aria-current", "page");

    const dashboardLink = screen.getByRole("link", { name: /Tổng quan/ });
    expect(dashboardLink).not.toHaveAttribute("aria-current");
  });
});

describe("MobileBottomNav Component", () => {
  beforeEach(() => {
    mockPathname = "/dashboard";
  });

  it("renders 5 primary tabs including Thêm", () => {
    render(<MobileBottomNav role="EMPLOYEE" />);

    expect(screen.getByRole("link", { name: "Hôm nay" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tổng quan" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Công việc" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Lịch" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Thêm" })).toBeInTheDocument();
  });

  it("opens More sheet when Thêm is clicked and renders secondary items", () => {
    render(<MobileBottomNav role="EMPLOYEE" />);

    const moreButton = screen.getByRole("button", { name: "Thêm" });
    fireEvent.click(moreButton);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Báo cáo/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Tìm kiếm/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Thông báo/ })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Đổi mật khẩu/ }),
    ).toBeInTheDocument();

    // EMPLOYEE must NOT see admin links
    expect(
      screen.queryByRole("link", { name: /Nhật ký hệ thống/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Quản lý người dùng/ }),
    ).not.toBeInTheDocument();
  });

  it("renders admin links in More sheet for HEAD role", () => {
    render(<MobileBottomNav role="HEAD" />);

    const moreButton = screen.getByRole("button", { name: "Thêm" });
    fireEvent.click(moreButton);

    expect(
      screen.getByRole("link", { name: /Nhật ký hệ thống/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Quản lý người dùng/ }),
    ).toBeInTheDocument();
  });
});
