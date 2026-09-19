export interface TodayOperationalSummary {
  total: number;
  completed: number;
  notCompleted: number;
  notReported: number;
  completionRate: number;
  overdueCount: number;
}

export interface EmployeeOperationalRow {
  userId: string;
  name: string;
  email: string;
  role: "HEAD" | "DEPUTY" | "EMPLOYEE";
  banned: boolean;
  total: number;
  completed: number;
  notCompleted: number;
  notReported: number;
  completionRate: number;
  overdueCount: number;
}

export interface OverdueTaskItem {
  id: string;
  title: string;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  assignedDate: string;
  dueDate: string;
  assignedToId: string;
  assignedToName: string;
}

export interface DashboardDto {
  businessToday: string;
  isTeamView: boolean;
  summary: TodayOperationalSummary;
  employeeBreakdown: EmployeeOperationalRow[];
  overdueTasks: OverdueTaskItem[];
}

export interface TaskRecordForDashboard {
  id: string;
  title: string;
  status: "OPEN" | "COMPLETED" | "CANCELLED";
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  assignedDate: string;
  dueDate: string | null;
  assignedToId: string;
  assignedToName?: string;
  deletedAt: Date | string | null;
}

export interface ReportRecordForDashboard {
  taskId: string;
  userId: string;
  reportDate: string;
  status: "COMPLETED" | "NOT_COMPLETED";
  reason: string | null;
}

export interface UserRecordForDashboard {
  id: string;
  name: string;
  email: string;
  role: "HEAD" | "DEPUTY" | "EMPLOYEE";
  banned: boolean;
}

/**
 * Checks whether a task belongs to today's operational task set.
 * A task belongs if:
 * 1. deletedAt is null
 * 2. assignedDate <= businessToday
 * 3. (status === 'OPEN' OR task has an official task_daily_update for businessToday)
 */
export function isTodayOperationalTask(
  task: TaskRecordForDashboard,
  hasReportToday: boolean,
  businessToday: string,
): boolean {
  if (task.deletedAt !== null) {
    return false;
  }
  if (task.assignedDate > businessToday) {
    return false;
  }
  return task.status === "OPEN" || hasReportToday;
}

/**
 * Checks whether a task is currently overdue.
 */
export function isTaskOverdue(
  task: { status: string; dueDate: string | null },
  businessToday: string,
): boolean {
  return (
    task.status === "OPEN" &&
    task.dueDate !== null &&
    task.dueDate < businessToday
  );
}

/**
 * Derives operational dashboard metrics from tasks, today's reports, and known users.
 * Implements Section H and Section I (same-day reassignment attribution).
 */
export function deriveDashboardMetrics(params: {
  tasks: TaskRecordForDashboard[];
  todayReports: ReportRecordForDashboard[];
  allUsers: UserRecordForDashboard[];
  businessToday: string;
  isTeamView: boolean;
  actorId: string;
}): DashboardDto {
  const { tasks, todayReports, allUsers, businessToday, isTeamView, actorId } =
    params;

  // Map today's reports by taskId (there can be at most 1 per taskId for businessToday)
  const reportByTaskId = new Map<string, ReportRecordForDashboard>();
  for (const report of todayReports) {
    if (report.reportDate === businessToday) {
      reportByTaskId.set(report.taskId, report);
    }
  }

  // Filter tasks to today's operational set
  const operationalTasks = tasks.filter((t) => {
    const hasReport = reportByTaskId.has(t.id);
    return isTodayOperationalTask(t, hasReport, businessToday);
  });

  // Calculate overall summary
  let completed = 0;
  let notCompleted = 0;
  let notReported = 0;

  for (const task of operationalTasks) {
    const report = reportByTaskId.get(task.id);
    if (!report) {
      notReported++;
    } else if (report.status === "COMPLETED") {
      completed++;
    } else if (report.status === "NOT_COMPLETED") {
      notCompleted++;
    }
  }

  const total = operationalTasks.length;
  const completionRate =
    total === 0 ? 0 : Math.round((completed / total) * 100);

  // Overdue tasks among all non-deleted visible tasks
  const overdueTasksList: OverdueTaskItem[] = tasks
    .filter((t) => t.deletedAt === null && isTaskOverdue(t, businessToday))
    .map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      assignedDate: t.assignedDate,
      dueDate: t.dueDate!,
      assignedToId: t.assignedToId,
      assignedToName: t.assignedToName || "Chưa phân công",
    }));

  const summary: TodayOperationalSummary = {
    total,
    completed,
    notCompleted,
    notReported,
    completionRate,
    overdueCount: overdueTasksList.length,
  };

  // Per-employee breakdown (only constructed for team view or relevant users)
  // Attribution rules (Section I):
  // If report exists -> attribute COMPLETED / NOT_COMPLETED to report.userId
  // If no report exists -> attribute NOT_REPORTED to current task.assignedToId
  // Also track overdue tasks by current task.assignedToId
  const userStats = new Map<
    string,
    {
      total: number;
      completed: number;
      notCompleted: number;
      notReported: number;
      overdueCount: number;
    }
  >();

  // Initialize for all team users if team view, or just the actor
  const relevantUsers = isTeamView
    ? allUsers
    : allUsers.filter((u) => u.id === actorId);

  for (const u of relevantUsers) {
    userStats.set(u.id, {
      total: 0,
      completed: 0,
      notCompleted: 0,
      notReported: 0,
      overdueCount: 0,
    });
  }

  // Count overdue per assignee
  for (const t of tasks) {
    if (t.deletedAt === null && isTaskOverdue(t, businessToday)) {
      let stats = userStats.get(t.assignedToId);
      if (!stats) {
        stats = {
          total: 0,
          completed: 0,
          notCompleted: 0,
          notReported: 0,
          overdueCount: 0,
        };
        userStats.set(t.assignedToId, stats);
      }
      stats.overdueCount++;
    }
  }

  // Attribute operational tasks
  for (const task of operationalTasks) {
    const report = reportByTaskId.get(task.id);
    if (report) {
      // Attribute to report.userId
      let stats = userStats.get(report.userId);
      if (!stats) {
        stats = {
          total: 0,
          completed: 0,
          notCompleted: 0,
          notReported: 0,
          overdueCount: 0,
        };
        userStats.set(report.userId, stats);
      }
      stats.total++;
      if (report.status === "COMPLETED") {
        stats.completed++;
      } else {
        stats.notCompleted++;
      }
    } else {
      // Attribute to current task.assignedToId
      let stats = userStats.get(task.assignedToId);
      if (!stats) {
        stats = {
          total: 0,
          completed: 0,
          notCompleted: 0,
          notReported: 0,
          overdueCount: 0,
        };
        userStats.set(task.assignedToId, stats);
      }
      stats.total++;
      stats.notReported++;
    }
  }

  // Build employee rows
  const userMap = new Map<string, UserRecordForDashboard>(
    allUsers.map((u) => [u.id, u]),
  );

  const employeeBreakdown: EmployeeOperationalRow[] = [];
  for (const [userId, stats] of userStats.entries()) {
    const u = userMap.get(userId);
    const name = u?.name || "Người dùng đã xóa";
    const email = u?.email || "";
    const role = u?.role || "EMPLOYEE";
    const banned = u?.banned ?? false;

    // For team view: only show employees who either have tasks/reports or are active accounts
    if (!isTeamView && userId !== actorId) {
      continue;
    }
    // In team view, show all ACTIVE users, PLUS any inactive users who have tasks/reports/overdue
    if (isTeamView && banned && stats.total === 0 && stats.overdueCount === 0) {
      continue;
    }

    const rowCompletionRate =
      stats.total === 0 ? 0 : Math.round((stats.completed / stats.total) * 100);

    employeeBreakdown.push({
      userId,
      name,
      email,
      role,
      banned,
      total: stats.total,
      completed: stats.completed,
      notCompleted: stats.notCompleted,
      notReported: stats.notReported,
      completionRate: rowCompletionRate,
      overdueCount: stats.overdueCount,
    });
  }

  // Sort employee rows: ACTIVE first, then alphabetical by name
  employeeBreakdown.sort((a, b) => {
    if (a.banned !== b.banned) {
      return a.banned ? 1 : -1;
    }
    return a.name.localeCompare(b.name, "vi");
  });

  return {
    businessToday,
    isTeamView,
    summary,
    employeeBreakdown,
    overdueTasks: overdueTasksList,
  };
}
