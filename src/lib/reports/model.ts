import { z } from "zod";
import { addDays, diffDays, isValidIsoDate } from "../calendar/date";
import { businessDateSchema } from "../tasks/validation";

export const MAX_REPORT_RANGE_DAYS = 366;
export const DEFAULT_REPORT_RANGE_DAYS = 30;

export const reportsQuerySchema = z
  .object({
    from: businessDateSchema.optional(),
    to: businessDateSchema.optional(),
  })
  .strict()
  .refine(
    (data) => {
      if (!data.from || !data.to) return true;
      if (!isValidIsoDate(data.from) || !isValidIsoDate(data.to)) return false;
      return data.from <= data.to;
    },
    {
      message: "Từ ngày phải nhỏ hơn hoặc bằng đến ngày.",
      path: ["from"],
    },
  )
  .refine(
    (data) => {
      if (!data.from || !data.to) return true;
      if (!isValidIsoDate(data.from) || !isValidIsoDate(data.to)) return false;
      return diffDays(data.from, data.to) <= MAX_REPORT_RANGE_DAYS;
    },
    {
      message: `Khoảng thời gian báo cáo tối đa là ${MAX_REPORT_RANGE_DAYS} ngày.`,
      path: ["to"],
    },
  );

export type ReportsQueryParams = z.infer<typeof reportsQuerySchema>;

export interface ReportSummaryDto {
  submittedReportsCount: number;
  completedReportsCount: number;
  notCompletedReportsCount: number;
  completionRatioSubmitted: number; // Ratio among submitted reports only!
  tasksCompletedInRange: number;
  tasksAssignedInRange: number;
  currentOverdueCount: number; // Current state only
}

export interface EmployeeReportRowDto {
  userId: string;
  name: string;
  email: string;
  role: "ADMIN" | "HEAD" | "DEPUTY" | "EMPLOYEE";
  banned: boolean;
  submittedReportsCount: number;
  completedReportsCount: number;
  notCompletedReportsCount: number;
  completionRatioSubmitted: number;
  currentOverdueCount: number;
}

export interface ReportsDto {
  from: string;
  to: string;
  businessToday: string;
  isTeamView: boolean;
  summary: ReportSummaryDto;
  employeeBreakdown: EmployeeReportRowDto[];
}

/**
 * Returns default from/to dates for reports (last 30 calendar days ending today).
 */
export function getDefaultReportRange(businessToday: string): {
  from: string;
  to: string;
} {
  return {
    from: addDays(businessToday, -(DEFAULT_REPORT_RANGE_DAYS - 1)),
    to: businessToday,
  };
}

export interface RawProgressReportForReport {
  taskId: string;
  userId: string;
  reportDate: string;
  status: "COMPLETED" | "NOT_COMPLETED";
}

export interface RawTaskForReport {
  id: string;
  title: string;
  status: "OPEN" | "COMPLETED" | "CANCELLED";
  assignedDate: string;
  dueDate: string | null;
  assignedToId: string;
  completedAt: Date | string | null;
  deletedAt: Date | string | null;
}

export interface RawUserForReport {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "HEAD" | "DEPUTY" | "EMPLOYEE";
  banned: boolean;
}

/**
 * Derives report metrics strictly from persisted records.
 * NEVER fabricates historical NOT_REPORTED.
 */
export function deriveReportMetrics(params: {
  from: string;
  to: string;
  businessToday: string;
  isTeamView: boolean;
  actorId: string;
  reportsInRange: RawProgressReportForReport[];
  tasks: RawTaskForReport[];
  allUsers: RawUserForReport[];
}): ReportsDto {
  const {
    from,
    to,
    businessToday,
    isTeamView,
    actorId,
    reportsInRange,
    tasks,
    allUsers,
  } = params;

  let submittedReportsCount = 0;
  let completedReportsCount = 0;
  let notCompletedReportsCount = 0;

  // Group reports by user
  const userReportStats = new Map<
    string,
    {
      submitted: number;
      completed: number;
      notCompleted: number;
    }
  >();

  for (const r of reportsInRange) {
    submittedReportsCount++;
    if (r.status === "COMPLETED") {
      completedReportsCount++;
    } else {
      notCompletedReportsCount++;
    }

    let stats = userReportStats.get(r.userId);
    if (!stats) {
      stats = { submitted: 0, completed: 0, notCompleted: 0 };
      userReportStats.set(r.userId, stats);
    }
    stats.submitted++;
    if (r.status === "COMPLETED") {
      stats.completed++;
    } else {
      stats.notCompleted++;
    }
  }

  const completionRatioSubmitted =
    submittedReportsCount === 0
      ? 0
      : Math.round((completedReportsCount / submittedReportsCount) * 100);

  // Count tasks assigned in range and tasks completed in range
  let tasksAssignedInRange = 0;
  let tasksCompletedInRange = 0;
  let currentOverdueCount = 0;

  const userOverdueStats = new Map<string, number>();

  for (const t of tasks) {
    if (t.deletedAt !== null) continue;

    // Assigned in range
    if (t.assignedDate >= from && t.assignedDate <= to) {
      tasksAssignedInRange++;
    }

    // Completed in range
    if (t.completedAt) {
      const completedIso =
        t.completedAt instanceof Date
          ? t.completedAt.toISOString().slice(0, 10)
          : String(t.completedAt).slice(0, 10);
      if (completedIso >= from && completedIso <= to) {
        tasksCompletedInRange++;
      }
    }

    // Current overdue (current state only)
    if (
      t.status === "OPEN" &&
      t.dueDate !== null &&
      t.dueDate < businessToday
    ) {
      currentOverdueCount++;
      userOverdueStats.set(
        t.assignedToId,
        (userOverdueStats.get(t.assignedToId) || 0) + 1,
      );
    }
  }

  const summary: ReportSummaryDto = {
    submittedReportsCount,
    completedReportsCount,
    notCompletedReportsCount,
    completionRatioSubmitted,
    tasksCompletedInRange,
    tasksAssignedInRange,
    currentOverdueCount,
  };

  // Build employee breakdown (for team view or actor)
  const userMap = new Map(allUsers.map((u) => [u.id, u]));
  const employeeBreakdown: EmployeeReportRowDto[] = [];

  const relevantUserIds = new Set<string>();
  if (isTeamView) {
    for (const u of allUsers) {
      relevantUserIds.add(u.id);
    }
    // Also include any reporter userId in case user was not in allUsers
    for (const userId of userReportStats.keys()) {
      relevantUserIds.add(userId);
    }
  } else {
    relevantUserIds.add(actorId);
  }

  for (const userId of relevantUserIds) {
    const rStats = userReportStats.get(userId) || {
      submitted: 0,
      completed: 0,
      notCompleted: 0,
    };
    const overdue = userOverdueStats.get(userId) || 0;
    const u = userMap.get(userId);

    // If user has zero submitted reports and zero overdue, and is banned, omit them
    if (u?.banned && rStats.submitted === 0 && overdue === 0) {
      continue;
    }
    // ADMIN is a system-level role: only show if they have operational report/overdue data
    if (u?.role === "ADMIN" && rStats.submitted === 0 && overdue === 0) {
      continue;
    }

    const ratio =
      rStats.submitted === 0
        ? 0
        : Math.round((rStats.completed / rStats.submitted) * 100);

    employeeBreakdown.push({
      userId,
      name: u?.name || "Người dùng",
      email: u?.email || "",
      role: u?.role || "EMPLOYEE",
      banned: u?.banned ?? false,
      submittedReportsCount: rStats.submitted,
      completedReportsCount: rStats.completed,
      notCompletedReportsCount: rStats.notCompleted,
      completionRatioSubmitted: ratio,
      currentOverdueCount: overdue,
    });
  }

  employeeBreakdown.sort((a, b) => {
    if (a.banned !== b.banned) return a.banned ? 1 : -1;
    return a.name.localeCompare(b.name, "vi");
  });

  return {
    from,
    to,
    businessToday,
    isTeamView,
    summary,
    employeeBreakdown,
  };
}
