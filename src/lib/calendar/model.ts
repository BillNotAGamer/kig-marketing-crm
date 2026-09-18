import { z } from "zod";
import { diffDays, isValidIsoDate } from "./date";

export type CalendarMarkerType = "ASSIGNED" | "DUE" | "BOTH";

export interface CalendarTaskDTO {
  id: string;
  title: string;
  description: string | null;
  status: "OPEN" | "COMPLETED" | "CANCELLED";
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  assignedDate: string; // ISO YYYY-MM-DD
  dueDate: string | null; // ISO YYYY-MM-DD
  createdById: string;
  assignedToId: string;
  creator: { id: string; name: string };
  assignee: { id: string; name: string };
  todayProgressStatus?: "COMPLETED" | "NOT_COMPLETED" | "NOT_REPORTED" | null;
}

export interface CalendarMarker {
  task: CalendarTaskDTO;
  date: string;
  markerType: CalendarMarkerType;
  isOverdue: boolean;
}

export const MAX_CALENDAR_RANGE_DAYS = 62;

export const calendarQuerySchema = z
  .object({
    from: z.string().refine(isValidIsoDate, {
      message: "From date must be a valid ISO calendar date (YYYY-MM-DD).",
    }),
    to: z.string().refine(isValidIsoDate, {
      message: "To date must be a valid ISO calendar date (YYYY-MM-DD).",
    }),
    view: z.enum(["month", "week", "agenda"]).optional(),
    date: z
      .string()
      .refine((val) => val === undefined || isValidIsoDate(val), {
        message: "Date must be a valid ISO calendar date (YYYY-MM-DD).",
      })
      .optional(),
  })
  .strict()
  .refine(
    (data) => {
      if (!isValidIsoDate(data.from) || !isValidIsoDate(data.to)) {
        return true; // individual field refinements already caught this
      }
      return data.from <= data.to;
    },
    {
      message: "From date must be on or before to date.",
      path: ["from"],
    },
  )
  .refine(
    (data) => {
      if (!isValidIsoDate(data.from) || !isValidIsoDate(data.to)) {
        return true;
      }
      return diffDays(data.from, data.to) <= MAX_CALENDAR_RANGE_DAYS;
    },
    {
      message: `Calendar query range cannot exceed ${MAX_CALENDAR_RANGE_DAYS} days.`,
      path: ["to"],
    },
  );

export type CalendarQueryInput = z.infer<typeof calendarQuerySchema>;

export function isTaskOverdue(
  task: { status: string; dueDate: string | null },
  businessToday: string,
): boolean {
  if (task.status !== "OPEN" || !task.dueDate) {
    return false;
  }
  return task.dueDate < businessToday;
}

/**
 * Derives task markers for a specific calendar date.
 * Enforces business rule:
 * - assignedDate = ASSIGNED
 * - dueDate = DUE
 * - assignedDate === dueDate = BOTH (deduplicated)
 * - Dates strictly between assignedDate and dueDate DO NOT produce a marker.
 */
export function deriveDateMarkers(
  tasks: CalendarTaskDTO[],
  targetDate: string,
  businessToday: string,
): CalendarMarker[] {
  const markers: CalendarMarker[] = [];

  for (const task of tasks) {
    const isAssigned = task.assignedDate === targetDate;
    const isDue = task.dueDate === targetDate;

    if (isAssigned && isDue) {
      markers.push({
        task,
        date: targetDate,
        markerType: "BOTH",
        isOverdue: isTaskOverdue(task, businessToday),
      });
    } else if (isAssigned) {
      markers.push({
        task,
        date: targetDate,
        markerType: "ASSIGNED",
        isOverdue: isTaskOverdue(task, businessToday),
      });
    } else if (isDue) {
      markers.push({
        task,
        date: targetDate,
        markerType: "DUE",
        isOverdue: isTaskOverdue(task, businessToday),
      });
    }
  }

  // Stable sort: Overdue first, then Urgent -> High -> Normal -> Low, then title
  const priorityRank: Record<string, number> = {
    URGENT: 4,
    HIGH: 3,
    NORMAL: 2,
    LOW: 1,
  };

  return markers.sort((a, b) => {
    if (a.isOverdue !== b.isOverdue) {
      return a.isOverdue ? -1 : 1;
    }
    const prioA = priorityRank[a.task.priority] ?? 0;
    const prioB = priorityRank[b.task.priority] ?? 0;
    if (prioA !== prioB) {
      return prioB - prioA;
    }
    return a.task.title.localeCompare(b.task.title);
  });
}

export interface TodayCategorizedTask {
  task: CalendarTaskDTO;
  isOverdue: boolean;
  isDueToday: boolean;
  isAssignedToday: boolean;
}

/**
 * Derives the categorized, deduplicated task list for the Employee "Today" experience.
 * Each task appears at most ONCE, but carries flags for all applicable categories.
 */
export function deriveEmployeeTodayTasks(
  tasks: CalendarTaskDTO[],
  businessToday: string,
): TodayCategorizedTask[] {
  const map = new Map<string, TodayCategorizedTask>();

  for (const task of tasks) {
    const overdue = isTaskOverdue(task, businessToday);
    const dueToday = task.dueDate === businessToday;
    const assignedToday = task.assignedDate === businessToday;

    if (overdue || dueToday || assignedToday) {
      map.set(task.id, {
        task,
        isOverdue: overdue,
        isDueToday: dueToday,
        isAssignedToday: assignedToday,
      });
    }
  }

  const priorityRank: Record<string, number> = {
    URGENT: 4,
    HIGH: 3,
    NORMAL: 2,
    LOW: 1,
  };

  return Array.from(map.values()).sort((a, b) => {
    // Overdue tasks take highest priority
    if (a.isOverdue !== b.isOverdue) {
      return a.isOverdue ? -1 : 1;
    }
    // Then due today
    if (a.isDueToday !== b.isDueToday) {
      return a.isDueToday ? -1 : 1;
    }
    // Then priority
    const prioA = priorityRank[a.task.priority] ?? 0;
    const prioB = priorityRank[b.task.priority] ?? 0;
    if (prioA !== prioB) {
      return prioB - prioA;
    }
    return a.task.title.localeCompare(b.task.title);
  });
}
