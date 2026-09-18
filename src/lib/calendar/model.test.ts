import { describe, expect, it } from "vitest";
import {
  calendarQuerySchema,
  deriveDateMarkers,
  deriveEmployeeTodayTasks,
  isTaskOverdue,
  type CalendarTaskDTO,
} from "./model";

const sampleTask = (
  overrides: Partial<CalendarTaskDTO> = {},
): CalendarTaskDTO => ({
  id: "task-1",
  title: "Test Task",
  description: "Test description",
  status: "OPEN",
  priority: "NORMAL",
  assignedDate: "2026-09-01",
  dueDate: "2026-09-05",
  createdById: "user-1",
  assignedToId: "user-2",
  creator: { id: "user-1", name: "Creator" },
  assignee: { id: "user-2", name: "Assignee" },
  ...overrides,
});

describe("Calendar Model & Marker Derivation", () => {
  describe("calendarQuerySchema", () => {
    it("accepts valid query inputs up to 62 days", () => {
      const valid = calendarQuerySchema.safeParse({
        from: "2026-09-01",
        to: "2026-09-30",
      });
      expect(valid.success).toBe(true);

      const maxRange = calendarQuerySchema.safeParse({
        from: "2026-08-01",
        to: "2026-10-02", // 62 days
      });
      expect(maxRange.success).toBe(true);
    });

    it("rejects invalid ISO dates", () => {
      const res = calendarQuerySchema.safeParse({
        from: "invalid-date",
        to: "2026-09-30",
      });
      expect(res.success).toBe(false);
    });

    it("rejects from date after to date", () => {
      const res = calendarQuerySchema.safeParse({
        from: "2026-09-30",
        to: "2026-09-01",
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain("on or before");
      }
    });

    it("rejects query range exceeding 62 days", () => {
      const res = calendarQuerySchema.safeParse({
        from: "2026-08-01",
        to: "2026-10-15", // 75 days
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain("cannot exceed 62 days");
      }
    });

    it("rejects unknown query fields", () => {
      const res = calendarQuerySchema.safeParse({
        from: "2026-09-01",
        to: "2026-09-10",
        extraParam: "injected",
      });
      expect(res.success).toBe(false);
    });
  });

  describe("isTaskOverdue", () => {
    const today = "2026-09-19";

    it("returns true only for OPEN tasks whose dueDate is before today", () => {
      expect(
        isTaskOverdue({ status: "OPEN", dueDate: "2026-09-18" }, today),
      ).toBe(true);
    });

    it("returns false if dueDate is today", () => {
      expect(
        isTaskOverdue({ status: "OPEN", dueDate: "2026-09-19" }, today),
      ).toBe(false);
    });

    it("returns false if dueDate is in the future", () => {
      expect(
        isTaskOverdue({ status: "OPEN", dueDate: "2026-09-20" }, today),
      ).toBe(false);
    });

    it("returns false if dueDate is null", () => {
      expect(isTaskOverdue({ status: "OPEN", dueDate: null }, today)).toBe(
        false,
      );
    });

    it("returns false for COMPLETED tasks even if dueDate was in the past", () => {
      expect(
        isTaskOverdue({ status: "COMPLETED", dueDate: "2026-09-10" }, today),
      ).toBe(false);
    });

    it("returns false for CANCELLED tasks even if dueDate was in the past", () => {
      expect(
        isTaskOverdue({ status: "CANCELLED", dueDate: "2026-09-10" }, today),
      ).toBe(false);
    });
  });

  describe("deriveDateMarkers", () => {
    const today = "2026-09-19";

    it("derives ASSIGNED on assignedDate and DUE on dueDate, with NO intermediate markers", () => {
      const task = sampleTask({
        assignedDate: "2026-09-01",
        dueDate: "2026-09-05",
      });
      const tasks = [task];

      // Assigned date
      const onAssigned = deriveDateMarkers(tasks, "2026-09-01", today);
      expect(onAssigned).toHaveLength(1);
      expect(onAssigned[0].markerType).toBe("ASSIGNED");

      // Due date
      const onDue = deriveDateMarkers(tasks, "2026-09-05", today);
      expect(onDue).toHaveLength(1);
      expect(onDue[0].markerType).toBe("DUE");

      // Intermediate dates (crucial business invariant!)
      expect(deriveDateMarkers(tasks, "2026-09-02", today)).toHaveLength(0);
      expect(deriveDateMarkers(tasks, "2026-09-03", today)).toHaveLength(0);
      expect(deriveDateMarkers(tasks, "2026-09-04", today)).toHaveLength(0);

      // Outside dates
      expect(deriveDateMarkers(tasks, "2026-08-31", today)).toHaveLength(0);
      expect(deriveDateMarkers(tasks, "2026-09-06", today)).toHaveLength(0);
    });

    it("produces a single BOTH marker when assignedDate === dueDate", () => {
      const task = sampleTask({
        assignedDate: "2026-09-10",
        dueDate: "2026-09-10",
      });
      const markers = deriveDateMarkers([task], "2026-09-10", today);
      expect(markers).toHaveLength(1);
      expect(markers[0].markerType).toBe("BOTH");
    });

    it("handles task without dueDate", () => {
      const task = sampleTask({
        assignedDate: "2026-09-10",
        dueDate: null,
      });
      const markers = deriveDateMarkers([task], "2026-09-10", today);
      expect(markers).toHaveLength(1);
      expect(markers[0].markerType).toBe("ASSIGNED");
    });

    it("preserves COMPLETED and CANCELLED statuses", () => {
      const completedTask = sampleTask({
        id: "t-comp",
        status: "COMPLETED",
        assignedDate: "2026-09-10",
        dueDate: "2026-09-10",
      });
      const cancelledTask = sampleTask({
        id: "t-canc",
        status: "CANCELLED",
        assignedDate: "2026-09-10",
        dueDate: null,
      });

      const markers = deriveDateMarkers(
        [completedTask, cancelledTask],
        "2026-09-10",
        today,
      );
      expect(markers).toHaveLength(2);
      expect(markers.find((m) => m.task.id === "t-comp")?.task.status).toBe(
        "COMPLETED",
      );
      expect(markers.find((m) => m.task.id === "t-canc")?.task.status).toBe(
        "CANCELLED",
      );
    });
  });

  describe("deriveEmployeeTodayTasks", () => {
    const today = "2026-09-19";

    it("deduplicates a task that is both assigned today and due today", () => {
      const task = sampleTask({
        id: "t-both",
        assignedDate: today,
        dueDate: today,
      });
      const items = deriveEmployeeTodayTasks([task], today);
      expect(items).toHaveLength(1);
      expect(items[0].isAssignedToday).toBe(true);
      expect(items[0].isDueToday).toBe(true);
      expect(items[0].isOverdue).toBe(false);
    });

    it("deduplicates an overdue task that was also assigned today", () => {
      // Impossible in pure chronology, but testing edge safety
      const task = sampleTask({
        id: "t-edge",
        assignedDate: today,
        dueDate: "2026-09-18", // overdue
        status: "OPEN",
      });
      const items = deriveEmployeeTodayTasks([task], today);
      expect(items).toHaveLength(1);
      expect(items[0].isAssignedToday).toBe(true);
      expect(items[0].isOverdue).toBe(true);
    });

    it("sorts overdue tasks first, then due today, then priority", () => {
      const overdueLow = sampleTask({
        id: "t-overdue-low",
        priority: "LOW",
        status: "OPEN",
        assignedDate: "2026-09-01",
        dueDate: "2026-09-10",
      });
      const dueTodayUrgent = sampleTask({
        id: "t-due-urgent",
        priority: "URGENT",
        status: "OPEN",
        assignedDate: "2026-09-15",
        dueDate: today,
      });
      const assignedTodayNormal = sampleTask({
        id: "t-assigned-normal",
        priority: "NORMAL",
        status: "OPEN",
        assignedDate: today,
        dueDate: "2026-09-25",
      });

      const items = deriveEmployeeTodayTasks(
        [assignedTodayNormal, dueTodayUrgent, overdueLow],
        today,
      );
      expect(items).toHaveLength(3);
      expect(items[0].task.id).toBe("t-overdue-low");
      expect(items[1].task.id).toBe("t-due-urgent");
      expect(items[2].task.id).toBe("t-assigned-normal");
    });
  });
});
