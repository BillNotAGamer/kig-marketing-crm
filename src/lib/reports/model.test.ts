import { describe, expect, it } from "vitest";
import {
  deriveReportMetrics,
  getDefaultReportRange,
  reportsQuerySchema,
} from "./model";

describe("Reports Model & Validation", () => {
  const businessToday = "2026-09-19";

  it("validates report query parameters correctly", () => {
    // Valid range
    const valid = reportsQuerySchema.safeParse({
      from: "2026-09-01",
      to: "2026-09-19",
    });
    expect(valid.success).toBe(true);

    // Empty parameters (uses defaults)
    const empty = reportsQuerySchema.safeParse({});
    expect(empty.success).toBe(true);

    // Inverted dates: from > to
    const inverted = reportsQuerySchema.safeParse({
      from: "2026-09-20",
      to: "2026-09-10",
    });
    expect(inverted.success).toBe(false);

    // Range exceeding 366 days
    const oversized = reportsQuerySchema.safeParse({
      from: "2025-01-01",
      to: "2026-01-10", // > 366 days
    });
    expect(oversized.success).toBe(false);

    // Malformed date
    const malformed = reportsQuerySchema.safeParse({
      from: "invalid-date",
      to: "2026-09-19",
    });
    expect(malformed.success).toBe(false);

    // Year 0000
    const yearZero = reportsQuerySchema.safeParse({
      from: "0000-01-01",
      to: "2026-09-19",
    });
    expect(yearZero.success).toBe(false);
  });

  it("computes default report range of 30 days ending today", () => {
    const range = getDefaultReportRange("2026-09-19");
    expect(range.to).toBe("2026-09-19");
    expect(range.from).toBe("2026-08-21"); // 30 days inclusive
  });

  it("derives report metrics accurately from persisted records without fabricating NOT_REPORTED", () => {
    const from = "2026-09-01";
    const to = "2026-09-19";

    const user1 = {
      id: "u-1",
      name: "User 1",
      email: "u1@kig.local",
      role: "EMPLOYEE" as const,
      banned: false,
    };
    const user2 = {
      id: "u-2",
      name: "User 2",
      email: "u2@kig.local",
      role: "EMPLOYEE" as const,
      banned: false,
    };

    const reportsInRange = [
      {
        taskId: "t-1",
        userId: "u-1",
        reportDate: "2026-09-05",
        status: "COMPLETED" as const,
      },
      {
        taskId: "t-2",
        userId: "u-1",
        reportDate: "2026-09-10",
        status: "NOT_COMPLETED" as const,
      },
      {
        taskId: "t-3",
        userId: "u-2",
        reportDate: "2026-09-12",
        status: "COMPLETED" as const,
      },
    ];

    const tasks = [
      {
        id: "t-1",
        title: "Task 1",
        status: "COMPLETED" as const,
        assignedDate: "2026-09-01",
        dueDate: "2026-09-05",
        assignedToId: "u-1",
        completedAt: new Date("2026-09-05T10:00:00Z"),
        deletedAt: null,
      },
      {
        id: "t-2",
        title: "Task 2",
        status: "OPEN" as const,
        assignedDate: "2026-09-05",
        dueDate: "2026-09-15", // Overdue!
        assignedToId: "u-1",
        completedAt: null,
        deletedAt: null,
      },
      {
        id: "t-3",
        title: "Task 3",
        status: "COMPLETED" as const,
        assignedDate: "2026-09-10",
        dueDate: null,
        assignedToId: "u-2",
        completedAt: new Date("2026-09-12T08:00:00Z"),
        deletedAt: null,
      },
      {
        id: "t-out",
        title: "Task Out",
        status: "OPEN" as const,
        assignedDate: "2026-08-20", // Outside range
        dueDate: null,
        assignedToId: "u-1",
        completedAt: null,
        deletedAt: null,
      },
    ];

    const result = deriveReportMetrics({
      from,
      to,
      businessToday,
      isTeamView: true,
      actorId: "head-id",
      reportsInRange,
      tasks,
      allUsers: [user1, user2],
    });

    // Submitted reports
    expect(result.summary.submittedReportsCount).toBe(3);
    expect(result.summary.completedReportsCount).toBe(2);
    expect(result.summary.notCompletedReportsCount).toBe(1);
    expect(result.summary.completionRatioSubmitted).toBe(67); // 2/3 = 67%

    // Tasks counts in range
    expect(result.summary.tasksAssignedInRange).toBe(3);
    expect(result.summary.tasksCompletedInRange).toBe(2);

    // Current overdue
    expect(result.summary.currentOverdueCount).toBe(1);

    // Per employee breakdown
    const row1 = result.employeeBreakdown.find((r) => r.userId === "u-1");
    expect(row1).toBeDefined();
    expect(row1!.submittedReportsCount).toBe(2);
    expect(row1!.completedReportsCount).toBe(1);
    expect(row1!.notCompletedReportsCount).toBe(1);
    expect(row1!.completionRatioSubmitted).toBe(50);
    expect(row1!.currentOverdueCount).toBe(1);

    const row2 = result.employeeBreakdown.find((r) => r.userId === "u-2");
    expect(row2).toBeDefined();
    expect(row2!.submittedReportsCount).toBe(1);
    expect(row2!.completedReportsCount).toBe(1);
    expect(row2!.notCompletedReportsCount).toBe(0);
    expect(row2!.completionRatioSubmitted).toBe(100);
    expect(row2!.currentOverdueCount).toBe(0);
  });
});
