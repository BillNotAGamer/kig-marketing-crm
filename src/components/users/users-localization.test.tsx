import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UserManagement } from "./user-management";
import {
  roleDisplay,
  roleSelectDisplay,
  getRoleLabel,
  taskStatusDisplay,
  taskPriorityDisplay,
  formatDisplayDate,
} from "@/lib/ui-labels";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

const mockUsers = [
  {
    id: "user-1",
    name: "Nguyễn Văn Admin",
    email: "admin@kigholding.vn",
    role: "HEAD" as const,
    banned: false,
    createdAt: "2026-09-15T10:00:00.000Z",
  },
  {
    id: "user-2",
    name: "Trần Thị Deputy",
    email: "deputy@kigholding.vn",
    role: "DEPUTY" as const,
    banned: true,
    createdAt: "2026-09-16T12:00:00.000Z",
  },
];

describe("UI Labels and Date Formatting Helpers", () => {
  it("translates canonical roles, task statuses, and priorities", () => {
    expect(roleDisplay["ADMIN"]).toBe("Quản trị viên (ADMIN)");
    expect(roleDisplay["HEAD"]).toBe("Trưởng phòng (HEAD)");
    expect(roleDisplay["DEPUTY"]).toBe("Phó phòng (DEPUTY)");
    expect(roleDisplay["EMPLOYEE"]).toBe("Nhân viên (EMPLOYEE)");

    expect(roleSelectDisplay["ADMIN"]).toBe("Quản trị viên (ADMIN)");
    expect(roleSelectDisplay["HEAD"]).toBe("Trưởng phòng (HEAD)");
    expect(roleSelectDisplay["DEPUTY"]).toBe("Phó phòng (DEPUTY)");
    expect(roleSelectDisplay["EMPLOYEE"]).toBe("Nhân viên (EMPLOYEE)");

    expect(getRoleLabel("ADMIN")).toBe("Quản trị viên (ADMIN)");
    expect(getRoleLabel("HEAD")).toBe("Trưởng phòng (HEAD)");
    expect(getRoleLabel("DEPUTY")).toBe("Phó phòng (DEPUTY)");
    expect(getRoleLabel("EMPLOYEE")).toBe("Nhân viên (EMPLOYEE)");

    expect(taskStatusDisplay["OPEN"]).toBe("Đang mở");
    expect(taskStatusDisplay["COMPLETED"]).toBe("Hoàn thành");
    expect(taskStatusDisplay["CANCELLED"]).toBe("Đã hủy");

    expect(taskPriorityDisplay["LOW"]).toBe("Thấp");
    expect(taskPriorityDisplay["NORMAL"]).toBe("Bình thường");
    expect(taskPriorityDisplay["HIGH"]).toBe("Cao");
    expect(taskPriorityDisplay["URGENT"]).toBe("Khẩn cấp");
  });

  it("formats dates as DD/MM/YYYY", () => {
    expect(formatDisplayDate("2026-09-19")).toBe("19/09/2026");
    expect(formatDisplayDate(new Date(2026, 8, 5))).toBe("05/09/2026");
  });
});

describe("UserManagement Component Vietnamese Localization", () => {
  it("renders Vietnamese creation form labels and placeholders", () => {
    render(<UserManagement users={mockUsers} actorId="user-1" />);

    expect(
      screen.getByText("Tạo người dùng", {
        selector: "[data-slot=card-title]",
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Họ và tên").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Email").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Vai trò").length).toBeGreaterThan(0);
    expect(screen.getByText("Mật khẩu ban đầu")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Mật khẩu gồm 6–128 ký tự. Hãy sử dụng mật khẩu mạnh và riêng biệt.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Tạo người dùng" }),
    ).toBeInTheDocument();

    // No English remnant
    expect(screen.queryByText("Create user")).not.toBeInTheDocument();
    expect(screen.queryByText("Initial password")).not.toBeInTheDocument();
  });

  it("renders Vietnamese role and status labels for active and inactive users", () => {
    render(
      <UserManagement
        users={mockUsers}
        actorId="admin-operator"
        actorRole="ADMIN"
      />,
    );

    // Active user (HEAD)
    expect(
      screen.getByText(/Trưởng phòng \(HEAD\) · Đang hoạt động/),
    ).toBeInTheDocument();

    // Inactive user (DEPUTY, banned: true)
    expect(
      screen.getByText(/Phó phòng \(DEPUTY\) · Ngừng hoạt động/),
    ).toBeInTheDocument();

    // Action buttons
    expect(
      screen.getByRole("button", { name: "Vô hiệu hóa người dùng" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Kích hoạt người dùng" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Đặt lại mật khẩu" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("button", { name: "Lưu thông tin" }),
    ).toHaveLength(2);
    expect(
      screen.getAllByRole("button", { name: "Thay đổi vai trò" }),
    ).toHaveLength(2);

    // No English remnant
    expect(screen.queryByText("Save identity")).not.toBeInTheDocument();
    expect(screen.queryByText("Change role")).not.toBeInTheDocument();
    expect(screen.queryByText("Disable user")).not.toBeInTheDocument();
    expect(screen.queryByText("Enable user")).not.toBeInTheDocument();
    expect(screen.queryByText("Reset password")).not.toBeInTheDocument();
  });
});
