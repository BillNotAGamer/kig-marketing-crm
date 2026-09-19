import { describe, expect, it } from "vitest";
import {
  deriveDashboardMetrics,
  isTaskOverdue,
  isTodayOperationalTask,
  ReportRecordForDashboard,
  TaskRecordForDashboard,
  UserRecordForDashboard,
} from "./model";

describe("Dashboard Model & Calculations", () => {
  const businessToday = "2026-09-19";

  const userA: UserRecordForDashboard = {
    id: "user-a",
    name: "Nguyen Van A",
    email: "a@kig.local",
    role: "EMPLOYEE",
    banned: false,
  };
  const userB: UserRecordForDashboard = {
    id: "user-b",
    name: "Tran Van B",
    email: "b@kig.local",
    role: "EMPLOYEE",
    banned: false,
  };
  const userInactive: UserRecordForDashboard = {
    id: "user-inactive",
    name: "Le Van Inactive",
    email: "inactive@kig.local",
    role: "EMPLOYEE",
    banned: true,
  };

  it("identifies today's operational task set accurately", () => {
    // 1. OPEN task assigned in past
    expect(
      isTodayOperationalTask(
        {
          id: "1",
          title: "T1",
          status: "OPEN",
          priority: "NORMAL",
          assignedDate: "2026-09-15",
          dueDate: null,
          assignedToId: "user-a",
          deletedAt: null,
        },
        false,
        businessToday,
      ),
    ).toBe(true);

    // 2. OPEN task assigned today
    expect(
      isTodayOperationalTask(
        {
          id: "2",
          title: "T2",
          status: "OPEN",
          priority: "NORMAL",
          assignedDate: "2026-09-19",
          dueDate: null,
          assignedToId: "user-a",
          deletedAt: null,
        },
        false,
        businessToday,
      ),
    ).toBe(true);

    // 3. Task assigned in the future: EXCLUDED
    expect(
      isTodayOperationalTask(
        {
          id: "3",
          title: "T3",
          status: "OPEN",
          priority: "NORMAL",
          assignedDate: "2026-09-20",
          dueDate: null,
          assignedToId: "user-a",
          deletedAt: null,
        },
        false,
        businessToday,
      ),
    ).toBe(false);

    // 4. Task completed yesterday with no report today: EXCLUDED
    expect(
      isTodayOperationalTask(
        {
          id: "4",
          title: "T4",
          status: "COMPLETED",
          priority: "NORMAL",
          assignedDate: "2026-09-15",
          dueDate: null,
          assignedToId: "user-a",
          deletedAt: null,
        },
        false,
        businessToday,
      ),
    ).toBe(false);

    // 5. Task completed today with report today: INCLUDED
    expect(
      isTodayOperationalTask(
        {
          id: "5",
          title: "T5",
          status: "COMPLETED",
          priority: "NORMAL",
          assignedDate: "2026-09-15",
          dueDate: null,
          assignedToId: "user-a",
          deletedAt: null,
        },
        true,
        businessToday,
      ),
    ).toBe(true);

    // 6. Soft-deleted task: EXCLUDED even if report exists
    expect(
      isTodayOperationalTask(
        {
          id: "6",
          title: "T6",
          status: "OPEN",
          priority: "NORMAL",
          assignedDate: "2026-09-15",
          dueDate: null,
          assignedToId: "user-a",
          deletedAt: new Date(),
        },
        true,
        businessToday,
      ),
    ).toBe(false);
  });

  it("determines overdue tasks correctly", () => {
    // OPEN and dueDate < today: overdue
    expect(
      isTaskOverdue({ status: "OPEN", dueDate: "2026-09-18" }, businessToday),
    ).toBe(true);

    // OPEN and dueDate === today: not overdue
    expect(
      isTaskOverdue({ status: "OPEN", dueDate: "2026-09-19" }, businessToday),
    ).toBe(false);

    // OPEN and dueDate > today: not overdue
    expect(
      isTaskOverdue({ status: "OPEN", dueDate: "2026-09-20" }, businessToday),
    ).toBe(false);

    // COMPLETED and dueDate < today: not overdue
    expect(
      isTaskOverdue(
        { status: "COMPLETED", dueDate: "2026-09-18" },
        businessToday,
      ),
    ).toBe(false);

    // CANCELLED and dueDate < today: not overdue
    expect(
      isTaskOverdue(
        { status: "CANCELLED", dueDate: "2026-09-18" },
        businessToday,
      ),
    ).toBe(false);

    // OPEN with null dueDate: not overdue
    expect(
      isTaskOverdue({ status: "OPEN", dueDate: null }, businessToday),
    ).toBe(false);
  });

  it("calculates summary metrics and handles 0 total", () => {
    const emptyResult = deriveDashboardMetrics({
      tasks: [],
      todayReports: [],
      allUsers: [userA],
      businessToday,
      isTeamView: false,
      actorId: "user-a",
    });

    expect(emptyResult.summary).toEqual({
      total: 0,
      completed: 0,
      notCompleted: 0,
      notReported: 0,
      completionRate: 0,
      overdueCount: 0,
    });
  });

  it("derives operational summary with COMPLETED, NOT_COMPLETED, and NOT_REPORTED", () => {
    const tasks: TaskRecordForDashboard[] = [
      // 1. Reported COMPLETED today
      {
        id: "t-1",
        title: "Task 1",
        status: "COMPLETED",
        priority: "NORMAL",
        assignedDate: "2026-09-18",
        dueDate: "2026-09-19",
        assignedToId: "user-a",
        assignedToName: "Nguyen Van A",
        deletedAt: null,
      },
      // 2. Reported NOT_COMPLETED today
      {
        id: "t-2",
        title: "Task 2",
        status: "OPEN",
        priority: "HIGH",
        assignedDate: "2026-09-18",
        dueDate: "2026-09-20",
        assignedToId: "user-a",
        assignedToName: "Nguyen Van A",
        deletedAt: null,
      },
      // 3. Not reported today (OPEN, assigned yesterday)
      {
        id: "t-3",
        title: "Task 3",
        status: "OPEN",
        priority: "URGENT",
        assignedDate: "2026-09-18",
        dueDate: "2026-09-18", // overdue!
        assignedToId: "user-a",
        assignedToName: "Nguyen Van A",
        deletedAt: null,
      },
      // 4. Future assigned (excluded)
      {
        id: "t-4",
        title: "Task 4",
        status: "OPEN",
        priority: "NORMAL",
        assignedDate: "2026-09-25",
        dueDate: null,
        assignedToId: "user-a",
        assignedToName: "Nguyen Van A",
        deletedAt: null,
      },
    ];

    const todayReports: ReportRecordForDashboard[] = [
      {
        taskId: "t-1",
        userId: "user-a",
        reportDate: "2026-09-19",
        status: "COMPLETED",
        reason: null,
      },
      {
        taskId: "t-2",
        userId: "user-a",
        reportDate: "2026-09-19",
        status: "NOT_COMPLETED",
        reason: "Waiting for approval",
      },
    ];

    const result = deriveDashboardMetrics({
      tasks,
      todayReports,
      allUsers: [userA],
      businessToday,
      isTeamView: false,
      actorId: "user-a",
    });

    expect(result.summary.total).toBe(3);
    expect(result.summary.completed).toBe(1);
    expect(result.summary.notCompleted).toBe(1);
    expect(result.summary.notReported).toBe(1);
    expect(result.summary.completionRate).toBe(33); // 1 / 3 = 33%
    expect(result.summary.overdueCount).toBe(1);
    expect(result.overdueTasks).toHaveLength(1);
    expect(result.overdueTasks[0].id).toBe("t-3");
  });

  it("handles same-day reassignment attribution correctly (Section I)", () => {
    // Task was reported NOT_COMPLETED by User A today, then reassigned to User B
    const tasks: TaskRecordForDashboard[] = [
      {
        id: "t-reassigned",
        title: "Reassigned Task",
        status: "OPEN",
        priority: "NORMAL",
        assignedDate: "2026-09-18",
        dueDate: "2026-09-19",
        assignedToId: "user-b", // Currently assigned to B!
        assignedToName: "Tran Van B",
        deletedAt: null,
      },
      {
        id: "t-b-unreported",
        title: "User B Unreported Task",
        status: "OPEN",
        priority: "NORMAL",
        assignedDate: "2026-09-19",
        dueDate: null,
        assignedToId: "user-b",
        assignedToName: "Tran Van B",
        deletedAt: null,
      },
    ];

    const todayReports: ReportRecordForDashboard[] = [
      {
        taskId: "t-reassigned",
        userId: "user-a", // Reported by User A!
        reportDate: "2026-09-19",
        status: "NOT_COMPLETED",
        reason: "Blocker encountered",
      },
    ];

    const result = deriveDashboardMetrics({
      tasks,
      todayReports,
      allUsers: [userA, userB],
      businessToday,
      isTeamView: true,
      actorId: "head-id",
    });

    // Total should be 2 tasks
    expect(result.summary.total).toBe(2);
    expect(result.summary.completed).toBe(0);
    expect(result.summary.notCompleted).toBe(1);
    expect(result.summary.notReported).toBe(1);

    // Per-employee attribution:
    // User A should get the NOT_COMPLETED report (and total = 1)
    const rowA = result.employeeBreakdown.find((r) => r.userId === "user-a");
    expect(rowA).toBeDefined();
    expect(rowA!.total).toBe(1);
    expect(rowA!.notCompleted).toBe(1);
    expect(rowA!.notReported).toBe(0);

    // User B should NOT receive a false NOT_REPORTED for t-reassigned!
    // User B only has 1 unreported task (t-b-unreported)
    const rowB = result.employeeBreakdown.find((r) => r.userId === "user-b");
    expect(rowB).toBeDefined();
    expect(rowB!.total).toBe(1);
    expect(rowB!.notCompleted).toBe(0);
    expect(rowB!.notReported).toBe(1);
  });

  it("keeps inactive users visible if they have operational work or overdue tasks", () => {
    const tasks: TaskRecordForDashboard[] = [
      {
        id: "t-inactive",
        title: "Inactive User Overdue Task",
        status: "OPEN",
        priority: "URGENT",
        assignedDate: "2026-09-10",
        dueDate: "2026-09-15",
        assignedToId: "user-inactive",
        assignedToName: "Le Van Inactive",
        deletedAt: null,
      },
    ];

    const result = deriveDashboardMetrics({
      tasks,
      todayReports: [],
      allUsers: [userA, userInactive],
      businessToday,
      isTeamView: true,
      actorId: "head-id",
    });

    const inactiveRow = result.employeeBreakdown.find(
      (r) => r.userId === "user-inactive",
    );
    expect(inactiveRow).toBeDefined();
    expect(inactiveRow!.banned).toBe(true);
    expect(inactiveRow!.overdueCount).toBe(1);
    expect(inactiveRow!.notReported).toBe(1);
  });
});
