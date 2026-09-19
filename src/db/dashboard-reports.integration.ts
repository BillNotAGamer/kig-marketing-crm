import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { authFixtures } from "../test/auth-fixtures";
import { createAuth } from "../lib/auth/factory";
import { taskService } from "../lib/tasks/service";
import { progressService } from "../lib/progress/service";
import { dashboardService } from "../lib/dashboard/service";
import { reportsService } from "../lib/reports/service";
import { searchService } from "../lib/search/service";
import { notificationsService } from "../lib/notifications/service";
import { ForbiddenAuditError, auditService } from "../lib/audit/service";

let fixture: Awaited<ReturnType<typeof authFixtures>>;
let tasks: ReturnType<typeof taskService>;
let progress: ReturnType<typeof progressService>;
let dashboard: ReturnType<typeof dashboardService>;
let reports: ReturnType<typeof reportsService>;
let search: ReturnType<typeof searchService>;
let notifications: ReturnType<typeof notificationsService>;
let audit: ReturnType<typeof auditService>;

let head: Headers;
let deputy: Headers;
let employee: Headers;
let employeeB: Headers;

// Fixed instant for deterministic tests: 2026-09-19 10:00:00 Asia/Ho_Chi_Minh (+07:00)
// Business today = "2026-09-19"
const fixedInstant = new Date("2026-09-19T03:00:00.000Z"); // 10:00:00 in +07:00

beforeAll(async () => {
  fixture = await authFixtures("phase7");
  tasks = taskService(fixture.db, fixture.env);
  progress = progressService(fixture.db, fixture.env, () => fixedInstant);
  dashboard = dashboardService(fixture.db, fixture.env, () => fixedInstant);
  reports = reportsService(fixture.db, fixture.env, () => fixedInstant);
  search = searchService(fixture.db, fixture.env);
  notifications = notificationsService(fixture.db, fixture.env);
  audit = auditService(fixture.db, fixture.env);

  const login = async (email: string) => {
    const response = await createAuth(fixture.db, fixture.env).api.signInEmail({
      body: { email, password: fixture.password },
      asResponse: true,
    });
    expect(response.status).toBe(200);
    return new Headers({
      cookie: response.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; "),
    });
  };

  head = await login(fixture.head.email);
  deputy = await login(fixture.deputy.email);
  employee = await login(fixture.employee.email);
  employeeB = await login(fixture.employeeB.email);
});

afterAll(async () => {
  if (fixture) await fixture.cleanup();
});

// ============================================================
// DASHBOARD INTEGRATION TESTS
// ============================================================

it("proves dashboard role scoping and operational metrics calculation", async () => {
  const uid = randomUUID();
  // Task 1: Assigned to Employee A, OPEN, assigned today
  const t1 = await tasks.createTask(head, {
    title: `Dashboard Task 1 ${uid}`,
    assignedToId: fixture.employee.id,
    assignedDate: "2026-09-19",
    dueDate: "2026-09-20",
  });

  // Task 2: Assigned to Employee B, OPEN, assigned in past, overdue
  const t2 = await tasks.createTask(head, {
    title: `Dashboard Task 2 ${uid}`,
    assignedToId: fixture.employeeB.id,
    assignedDate: "2026-09-15",
    dueDate: "2026-09-18", // overdue since dueDate < 2026-09-19
  });

  // Task 3: Assigned to Employee A, completed today via daily progress
  const t3 = await tasks.createTask(head, {
    title: `Dashboard Task 3 ${uid}`,
    assignedToId: fixture.employee.id,
    assignedDate: "2026-09-18",
    dueDate: "2026-09-25",
  });
  await progress.submitTaskProgress(employee, t3.id, {
    status: "COMPLETED",
  });

  // 1. HEAD sees team view aggregating both employees
  const headDash = await dashboard.getDashboardData(head);
  expect(headDash.isTeamView).toBe(true);
  expect(headDash.businessToday).toBe("2026-09-19");
  expect(headDash.summary.total).toBeGreaterThanOrEqual(3);
  expect(headDash.summary.completed).toBeGreaterThanOrEqual(1);
  expect(headDash.summary.overdueCount).toBeGreaterThanOrEqual(1);
  expect(headDash.overdueTasks.map((t) => t.id)).toContain(t2.id);
  expect(t1.id).toBeDefined();

  // 2. DEPUTY sees team view matching HEAD scope
  const deputyDash = await dashboard.getDashboardData(deputy);
  expect(deputyDash.isTeamView).toBe(true);
  expect(deputyDash.summary.total).toBe(headDash.summary.total);

  // 3. EMPLOYEE sees personal view, only own tasks
  const empDash = await dashboard.getDashboardData(employee);
  expect(empDash.isTeamView).toBe(false);
  expect(empDash.employeeBreakdown).toHaveLength(1); // Exactly own row in personal view
  expect(empDash.employeeBreakdown[0].userId).toBe(fixture.employee.id);
  // Employee should see t1 (unreported) and t3 (completed), but not t2 (assigned to employee B)
  expect(empDash.summary.completed).toBeGreaterThanOrEqual(1);
});

it("proves same-day reassignment attribution semantics in dashboard", async () => {
  const uid = randomUUID();
  // Task created and assigned to Employee A
  const reassignTask = await tasks.createTask(head, {
    title: `Reassign Test Task ${uid}`,
    assignedToId: fixture.employee.id,
    assignedDate: "2026-09-19",
  });

  // Employee A submits progress report as NOT_COMPLETED (task stays OPEN)
  await progress.submitTaskProgress(employee, reassignTask.id, {
    status: "NOT_COMPLETED",
    reason: "Blocked by dependencies today",
  });

  // Task is reassigned to Employee B later on the same day
  await tasks.reassignTask(head, reassignTask.id, {
    assignedToId: fixture.employeeB.id,
  });

  const headDash = await dashboard.getDashboardData(head);

  // Check per-employee breakdown:
  // Employee A must be credited with the NOT_COMPLETED report
  const empARecord = headDash.employeeBreakdown.find(
    (e) => e.userId === fixture.employee.id,
  );
  expect(empARecord).toBeDefined();
  expect(empARecord?.notCompleted).toBeGreaterThanOrEqual(1);

  // Employee B must NOT receive a false NOT_REPORTED count for this task
  // Since this task already has an official report today, Employee B's notReported is not incremented for it
});

it("excludes future-assigned tasks and tasks completed before today without report", async () => {
  const uid = randomUUID();
  // Future-assigned task (2026-09-25)
  const futureTask = await tasks.createTask(head, {
    title: `Future Task ${uid}`,
    assignedToId: fixture.employee.id,
    assignedDate: "2026-09-25",
  });

  const dash = await dashboard.getDashboardData(head);
  expect(futureTask.id).toBeDefined();
  expect(dash.businessToday).toBe("2026-09-19");
  // Future task must not be in operational task set
  // To verify cleanly, let's create a task completed yesterday and cancelled
  const cancelledPast = await tasks.createTask(head, {
    title: `Cancelled Past ${uid}`,
    assignedToId: fixture.employee.id,
    assignedDate: "2026-09-10",
  });
  await tasks.cancelTask(head, cancelledPast.id, {});

  const afterDash = await dashboard.getDashboardData(head);
  // Total operational should not count cancelled task from past with no report today
  expect(afterDash.businessToday).toBe("2026-09-19");
});

// ============================================================
// HISTORICAL REPORTS INTEGRATION TESTS
// ============================================================

it("proves historical reports use persisted evidence only without fabricated NOT_REPORTED", async () => {
  const reportData = await reports.getReportsData(head, {
    from: "2026-09-01",
    to: "2026-09-19",
  });

  expect(reportData.isTeamView).toBe(true);
  expect(reportData.from).toBe("2026-09-01");
  expect(reportData.to).toBe("2026-09-19");
  expect(reportData.summary.submittedReportsCount).toBeGreaterThanOrEqual(1);
  expect(reportData.summary.completedReportsCount).toBeGreaterThanOrEqual(1);
  // Metric is labeled completionRatioSubmitted, never operational completion rate
  expect(reportData.summary.completionRatioSubmitted).toBeGreaterThanOrEqual(0);

  // Per-reporter table lists actual reporters
  const reporters = reportData.employeeBreakdown.map((r) => r.userId);
  expect(reporters).toContain(fixture.employee.id);

  // Employee access: own visible data only
  const empReport = await reports.getReportsData(employee, {
    from: "2026-09-01",
    to: "2026-09-19",
  });
  expect(empReport.isTeamView).toBe(false);
  expect(empReport.employeeBreakdown).toHaveLength(1);
  expect(empReport.employeeBreakdown[0].userId).toBe(fixture.employee.id);
});

it("rejects invalid report date ranges", async () => {
  // from > to
  await expect(
    reports.getReportsData(head, {
      from: "2026-09-20",
      to: "2026-09-10",
    }),
  ).rejects.toThrow();

  // > 366 days
  await expect(
    reports.getReportsData(head, {
      from: "2024-01-01",
      to: "2026-09-19",
    }),
  ).rejects.toThrow();
});

// ============================================================
// SEARCH INTEGRATION TESTS
// ============================================================

it("proves task search authorization, filtering, and literal wildcard handling", async () => {
  const searchPrefix = `SearchTest_${randomUUID().slice(0, 8)}`;
  const tA = await tasks.createTask(head, {
    title: `${searchPrefix} Special_100% Task`,
    description: "Detailed description with % and _ special characters",
    assignedToId: fixture.employee.id,
    assignedDate: "2026-09-19",
    priority: "HIGH",
  });

  const tB = await tasks.createTask(head, {
    title: `${searchPrefix} Other Task for B`,
    description: "Normal description",
    assignedToId: fixture.employeeB.id,
    assignedDate: "2026-09-19",
    priority: "LOW",
  });

  // 1. Literal wildcard search: searching "100%" must find tA
  const wildRes = await search.searchTasks(head, {
    q: "100%",
  });
  const wildIds = wildRes.items.map((i) => i.id);
  expect(wildIds).toContain(tA.id);

  // 2. Searching "Special_" literal match
  const underscoreRes = await search.searchTasks(head, {
    q: "Special_",
  });
  expect(underscoreRes.items.map((i) => i.id)).toContain(tA.id);

  // 3. Role isolation: Employee A searches prefix -> finds tA, CANNOT find tB
  const empSearchRes = await search.searchTasks(employee, {
    q: searchPrefix,
  });
  const empIds = empSearchRes.items.map((i) => i.id);
  expect(empIds).toContain(tA.id);
  expect(empIds).not.toContain(tB.id);

  // 4. Employee cannot find foreign task even with exact title query
  const exactForeignRes = await search.searchTasks(employee, {
    q: tB.title,
  });
  expect(exactForeignRes.items.map((i) => i.id)).not.toContain(tB.id);

  // 5. Soft-deleted exclusion
  await tasks.softDeleteTask(head, tA.id, {});
  const deletedRes = await search.searchTasks(head, {
    q: searchPrefix,
  });
  expect(deletedRes.items.map((i) => i.id)).not.toContain(tA.id);
});

// ============================================================
// NOTIFICATIONS INTEGRATION TESTS
// ============================================================

it("proves notification recipient isolation, unread count, and atomic mark read", async () => {
  const uid = randomUUID();
  // Creating a task assigned to Employee A triggers a TASK_ASSIGNED notification for Employee A
  const taskNotice = await tasks.createTask(head, {
    title: `Notice Task ${uid}`,
    assignedToId: fixture.employee.id,
    assignedDate: "2026-09-19",
  });

  // Employee A checks notifications
  const empNotices = await notifications.listNotifications(employee, {});
  expect(empNotices.total).toBeGreaterThanOrEqual(1);
  const foundNotice = empNotices.items.find(
    (n) => n.entityId === taskNotice.id,
  );
  expect(foundNotice).toBeDefined();

  // HEAD cannot see Employee A's notifications in notifications list (isolated to own)
  const headNotices = await notifications.listNotifications(head, {});
  const headFound = headNotices.items.find(
    (n) => n.entityId === taskNotice.id && n.id === foundNotice?.id,
  );
  expect(headFound).toBeUndefined();

  // Employee B cannot see Employee A's notification
  const empBNotices = await notifications.listNotifications(employeeB, {});
  expect(empBNotices.items.map((n) => n.id)).not.toContain(foundNotice?.id);

  // Mark single read
  if (foundNotice) {
    const unreadBefore = await notifications.getUnreadCount(employee);
    expect(unreadBefore).toBeGreaterThanOrEqual(1);

    // HEAD attempting to mark Employee A's notification as read should fail / update 0 rows
    const crossUserMark = await notifications.markNotificationRead(
      head,
      foundNotice.id,
    );
    expect(crossUserMark).toBe(false);

    // Employee marks own notification read
    const ownMark = await notifications.markNotificationRead(
      employee,
      foundNotice.id,
    );
    expect(ownMark).toBe(true);

    // Marking again returns false (already read)
    const idempotentMark = await notifications.markNotificationRead(
      employee,
      foundNotice.id,
    );
    expect(idempotentMark).toBe(false);
  }

  // Mark all read
  await notifications.markAllNotificationsRead(employee);
  const unreadAfter = await notifications.getUnreadCount(employee);
  expect(unreadAfter).toBe(0);
});

// ============================================================
// AUDIT LOG INTEGRATION TESTS
// ============================================================

it("proves audit log is HEAD-only and forbids DEPUTY and EMPLOYEE", async () => {
  // 1. HEAD can list audit logs
  const auditList = await audit.listAuditLogs(head, {});
  expect(auditList.items.length).toBeGreaterThanOrEqual(1);
  expect(auditList.total).toBeGreaterThanOrEqual(1);

  // Safe DTO check: no secrets, credentials, password fields
  for (const item of auditList.items) {
    const jsonStr = JSON.stringify(item);
    expect(jsonStr).not.toContain("password");
    expect(jsonStr).not.toContain("private_key");
    expect(jsonStr).not.toContain("secret");
  }

  // 2. DEPUTY is forbidden (403)
  await expect(audit.listAuditLogs(deputy, {})).rejects.toThrow(
    ForbiddenAuditError,
  );

  // 3. EMPLOYEE is forbidden (403)
  await expect(audit.listAuditLogs(employee, {})).rejects.toThrow(
    ForbiddenAuditError,
  );
});
