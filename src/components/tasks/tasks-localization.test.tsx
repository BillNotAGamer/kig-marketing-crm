import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TaskForm } from "./task-form";
import { TaskActions } from "./task-actions";
import type { TaskDTO, AssigneeOption } from "@/lib/tasks/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

const mockOptions: AssigneeOption[] = [
  { id: "u-1", name: "Nguyễn Văn Employee", role: "EMPLOYEE" },
  { id: "u-2", name: "Trần Thị Deputy", role: "DEPUTY" },
];

const mockTask: TaskDTO = {
  id: "task-1",
  title: "Thiết kế poster",
  description: "Thiết kế poster sự kiện",
  status: "OPEN",
  priority: "HIGH",
  assignedDate: "2026-09-19",
  dueDate: "2026-09-25",
  brandId: null,
  brandName: null,
  assignedToId: "u-1",
  createdById: "head-1",
  completedAt: null,
  cancelledAt: null,
  createdAt: "2026-09-19T08:00:00.000Z",
  updatedAt: "2026-09-19T08:00:00.000Z",
  assignee: { id: "u-1", name: "Nguyễn Văn Employee" },
  creator: { id: "head-1", name: "Admin Head" },
};

describe("TaskForm Component Vietnamese Localization", () => {
  it("renders Vietnamese field labels and button text for creation", () => {
    render(
      <TaskForm
        options={mockOptions}
        employee={false}
        assignedDate="2026-09-19"
      />,
    );

    expect(screen.getByText("Tiêu đề")).toBeInTheDocument();
    expect(screen.getByText("Mô tả")).toBeInTheDocument();
    expect(screen.getByText("Người thực hiện")).toBeInTheDocument();
    expect(screen.getByText("Thương hiệu")).toBeInTheDocument();
    expect(screen.getByText("Ngày giao việc")).toBeInTheDocument();
    expect(
      screen.getByText("Hạn hoàn thành (không bắt buộc)"),
    ).toBeInTheDocument();
    expect(screen.getByText("Độ ưu tiên")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Tạo công việc" }),
    ).toBeInTheDocument();

    // Priority options translated
    expect(screen.getByRole("option", { name: "Thấp" })).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Bình thường" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Cao" })).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Khẩn cấp" }),
    ).toBeInTheDocument();

    // No English remnant
    expect(screen.queryByText("Title")).not.toBeInTheDocument();
    expect(screen.queryByText("Description")).not.toBeInTheDocument();
    expect(screen.queryByText("Priority")).not.toBeInTheDocument();
  });
});

describe("TaskActions Component Vietnamese Localization", () => {
  it("renders Vietnamese administrative actions and options", () => {
    render(<TaskActions task={mockTask} options={mockOptions} />);

    expect(
      screen.getByRole("heading", { name: "Quản trị công việc" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Chỉnh sửa công việc" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Người thực hiện mới")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Chuyển giao công việc" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Hủy công việc" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Xóa công việc" }),
    ).toBeInTheDocument();

    // No English remnant
    expect(screen.queryByText("Manage task")).not.toBeInTheDocument();
    expect(screen.queryByText("Edit task")).not.toBeInTheDocument();
    expect(screen.queryByText("Reassign task")).not.toBeInTheDocument();
    expect(screen.queryByText("Cancel task")).not.toBeInTheDocument();
    expect(screen.queryByText("Delete task")).not.toBeInTheDocument();
  });
});
