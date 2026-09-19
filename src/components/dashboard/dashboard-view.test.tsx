import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DashboardView } from "./dashboard-view";
import type { DashboardDto } from "@/lib/dashboard/model";

const emptyDashboardData: DashboardDto = {
  businessToday: "2026-09-19",
  summary: {
    total: 0,
    completed: 0,
    notCompleted: 0,
    notReported: 0,
    completionRate: 0,
    overdueCount: 0,
  },
  employeeBreakdown: [
    {
      userId: "user-1",
      name: "Nguyễn Văn Employee",
      email: "hidden-employee@kigholding.vn",
      role: "EMPLOYEE",
      banned: false,
      total: 0,
      completed: 0,
      notCompleted: 0,
      notReported: 0,
      completionRate: 0,
      overdueCount: 0,
    },
  ],
  overdueTasks: [],
  isTeamView: true,
};

const overdueDashboardData: DashboardDto = {
  ...emptyDashboardData,
  summary: {
    ...emptyDashboardData.summary,
    overdueCount: 1,
  },
  overdueTasks: [
    {
      id: "task-overdue-1",
      title: "Khẩn cấp: Bài viết Facebook chưa duyệt",
      priority: "URGENT",
      dueDate: "2026-09-18",
      assignedDate: "2026-09-15",
      assignedToId: "user-1",
      assignedToName: "Nguyễn Văn Employee",
    },
  ],
};

describe("DashboardView Component Polish", () => {
  it("renders neutral overdue heading and neutral empty card when overdue count is 0", () => {
    render(<DashboardView data={emptyDashboardData} />);

    const overdueHeading = screen.getByRole("heading", {
      name: /Công việc đang quá hạn \(0\)/,
    });
    expect(overdueHeading).toBeInTheDocument();
    expect(overdueHeading.className).not.toContain("text-destructive");
    expect(overdueHeading.className).toContain("text-foreground");

    expect(
      screen.getByText("Tuyệt vời! Không có công việc nào đang quá hạn."),
    ).toBeInTheDocument();
  });

  it("renders alarming red overdue heading when overdue count is > 0", () => {
    render(<DashboardView data={overdueDashboardData} />);

    const overdueHeading = screen.getByRole("heading", {
      name: /Công việc đang quá hạn \(1\)/,
    });
    expect(overdueHeading).toBeInTheDocument();
    expect(overdueHeading.className).toContain("text-destructive");

    expect(
      screen.getByText("Khẩn cấp: Bài viết Facebook chưa duyệt"),
    ).toBeInTheDocument();
  });

  it("omits employee email from table presentation while keeping name and role", () => {
    render(<DashboardView data={emptyDashboardData} />);

    expect(screen.getByText("Nguyễn Văn Employee")).toBeInTheDocument();
    expect(screen.getByText("EMPLOYEE")).toBeInTheDocument();
    expect(
      screen.queryByText(/hidden-employee@kigholding\.vn/),
    ).not.toBeInTheDocument();
  });
});
