// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  DELETED_USER_SENTINEL_ID,
  DELETED_USER_SENTINEL_NAME,
  isSentinelUserId,
} from "./sentinel";
import { canPermanentlyDeleteUser } from "./policy";
import { AccessError } from "../auth/permissions";
import type { AppRole } from "../auth/roles";
import type { Actor } from "../auth/session-core";

function makeActor(role: AppRole, id = "actor-id"): Actor {
  return { id, role, name: "Actor", email: `${role.toLowerCase()}@kig.vn` };
}

describe("Permanent User Deletion — Business Rules & History Preservation (Offline)", () => {
  describe("Sentinel Identification & Invariants", () => {
    it("has the deterministic UUID 00000000-0000-0000-0000-000000000000", () => {
      expect(DELETED_USER_SENTINEL_ID).toBe(
        "00000000-0000-0000-0000-000000000000",
      );
      expect(DELETED_USER_SENTINEL_NAME).toBe("Người dùng đã xóa");
    });

    it("correctly identifies the sentinel ID", () => {
      expect(isSentinelUserId(DELETED_USER_SENTINEL_ID)).toBe(true);
      expect(isSentinelUserId("any-other-uuid")).toBe(false);
      expect(isSentinelUserId(undefined)).toBe(false);
    });

    it("forbids any actor from permanently deleting the sentinel", () => {
      const admin = makeActor("ADMIN", "admin-1");
      expect(
        canPermanentlyDeleteUser(admin, {
          id: DELETED_USER_SENTINEL_ID,
          role: "EMPLOYEE",
        }),
      ).toBe(false);
    });
  });

  describe("Open Task Guard Simulation", () => {
    type MockTask = {
      id: string;
      title: string;
      assignedToId: string;
      status: "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
      deletedAt: Date | null;
    };

    function validateOpenTasksBeforeDelete(
      tasks: MockTask[],
      targetId: string,
    ) {
      const activeOpenTasks = tasks.filter(
        (t) =>
          t.assignedToId === targetId &&
          t.status === "OPEN" &&
          t.deletedAt === null,
      );
      if (activeOpenTasks.length > 0) {
        throw new AccessError(
          409,
          `Người dùng đang có ${activeOpenTasks.length} công việc chưa hoàn thành. Vui lòng chuyển giao công việc trước khi xóa.`,
        );
      }
    }

    it("blocks deletion with 409 when target has active OPEN tasks", () => {
      const tasks: MockTask[] = [
        {
          id: "task-1",
          title: "Thiết kế banner",
          assignedToId: "emp-target",
          status: "OPEN",
          deletedAt: null,
        },
      ];

      expect(() =>
        validateOpenTasksBeforeDelete(tasks, "emp-target"),
      ).toThrowError(
        new AccessError(
          409,
          "Người dùng đang có 1 công việc chưa hoàn thành. Vui lòng chuyển giao công việc trước khi xóa.",
        ),
      );
    });

    it("allows deletion when target only has COMPLETED or CANCELLED tasks", () => {
      const tasks: MockTask[] = [
        {
          id: "task-1",
          title: "Thiết kế banner",
          assignedToId: "emp-target",
          status: "COMPLETED",
          deletedAt: null,
        },
        {
          id: "task-2",
          title: "Viết bài PR",
          assignedToId: "emp-target",
          status: "CANCELLED",
          deletedAt: null,
        },
      ];

      expect(() =>
        validateOpenTasksBeforeDelete(tasks, "emp-target"),
      ).not.toThrow();
    });

    it("allows deletion when target's OPEN task is soft-deleted", () => {
      const tasks: MockTask[] = [
        {
          id: "task-1",
          title: "Thiết kế cũ",
          assignedToId: "emp-target",
          status: "OPEN",
          deletedAt: new Date(),
        },
      ];

      expect(() =>
        validateOpenTasksBeforeDelete(tasks, "emp-target"),
      ).not.toThrow();
    });

    it("allows deletion after open tasks are reassigned to another user", () => {
      const tasks: MockTask[] = [
        {
          id: "task-1",
          title: "Thiết kế banner",
          assignedToId: "emp-target",
          status: "OPEN",
          deletedAt: null,
        },
      ];

      // Blocked before reassignment
      expect(() =>
        validateOpenTasksBeforeDelete(tasks, "emp-target"),
      ).toThrowError(AccessError);

      // Reassign to another active employee
      tasks[0].assignedToId = "emp-other";

      // Now allowed
      expect(() =>
        validateOpenTasksBeforeDelete(tasks, "emp-target"),
      ).not.toThrow();
    });
  });

  describe("Historical Records Reassignment & Integrity Simulation", () => {
    it("simulates full transactional cleanup and repointing to sentinel", () => {
      const targetId = "user-to-delete-uuid";
      const otherUser = "other-user-uuid";

      // 1. Task records
      const tasks = [
        {
          id: "task-1",
          createdById: targetId,
          assignedToId: targetId,
          deletedById: targetId,
          status: "COMPLETED" as const,
        },
        {
          id: "task-2",
          createdById: otherUser,
          assignedToId: otherUser,
          deletedById: null,
          status: "OPEN" as const,
        },
      ];

      // 2. Task Asset records
      const taskAssets = [
        {
          id: "asset-1",
          createdById: targetId,
          deletedById: targetId,
        },
      ];

      // 3. Task Daily Updates
      const progressUpdates = [
        {
          id: "prog-1",
          userId: targetId,
          correctedById: targetId,
        },
      ];

      // 4. Brand records
      const brands = [
        {
          id: "brand-1",
          name: "KIG Holding",
          createdById: targetId as string | null,
        },
      ];

      // 5. Auth / transient tables
      let notifications = [
        { id: "notif-1", userId: targetId },
        { id: "notif-2", userId: otherUser },
      ];
      let sessions = [
        { id: "sess-1", userId: targetId },
        { id: "sess-2", userId: otherUser },
      ];
      let accounts = [
        { id: "acc-1", userId: targetId },
        { id: "acc-2", userId: otherUser },
      ];
      let users = [
        { id: targetId, name: "Target User", role: "EMPLOYEE" },
        { id: otherUser, name: "Other User", role: "ADMIN" },
      ];

      // 6. Audit log
      const auditLogs = [
        {
          id: "audit-1",
          actorUserId: targetId,
          action: "CREATE_TASK",
          entityType: "task",
        },
      ];

      // --- EXECUTE TRANSACTIONAL PERMANENT DELETION ---
      // Step A: Repoint task references
      for (const t of tasks) {
        if (t.createdById === targetId)
          t.createdById = DELETED_USER_SENTINEL_ID;
        if (t.assignedToId === targetId)
          t.assignedToId = DELETED_USER_SENTINEL_ID;
        if (t.deletedById === targetId)
          t.deletedById = DELETED_USER_SENTINEL_ID;
      }

      // Step B: Repoint asset references
      for (const a of taskAssets) {
        if (a.createdById === targetId)
          a.createdById = DELETED_USER_SENTINEL_ID;
        if (a.deletedById === targetId)
          a.deletedById = DELETED_USER_SENTINEL_ID;
      }

      // Step C: Repoint progress references
      for (const p of progressUpdates) {
        if (p.userId === targetId) p.userId = DELETED_USER_SENTINEL_ID;
        if (p.correctedById === targetId)
          p.correctedById = DELETED_USER_SENTINEL_ID;
      }

      // Step D: Brand createdById -> NULL (brand survives)
      for (const b of brands) {
        if (b.createdById === targetId) b.createdById = null;
      }

      // Step E: Delete private notifications
      notifications = notifications.filter((n) => n.userId !== targetId);

      // Step F: Delete sessions and accounts
      sessions = sessions.filter((s) => s.userId !== targetId);
      accounts = accounts.filter((a) => a.userId !== targetId);

      // Step G: Insert DELETE_USER audit entry (before user deletion)
      auditLogs.push({
        id: "audit-2",
        actorUserId: "admin-actor-uuid",
        action: "DELETE_USER",
        entityType: "user",
      });

      // Step H: Delete user row
      users = users.filter((u) => u.id !== targetId);

      // --- VERIFY POST-DELETION STATE ---
      // Real user row gone
      expect(users.find((u) => u.id === targetId)).toBeUndefined();
      expect(users).toHaveLength(1);

      // Auth credentials and sessions purged
      expect(sessions.find((s) => s.userId === targetId)).toBeUndefined();
      expect(accounts.find((a) => a.userId === targetId)).toBeUndefined();
      expect(notifications.find((n) => n.userId === targetId)).toBeUndefined();

      // Historical task survives with sentinel foreign keys
      expect(tasks[0].createdById).toBe(DELETED_USER_SENTINEL_ID);
      expect(tasks[0].assignedToId).toBe(DELETED_USER_SENTINEL_ID);
      expect(tasks[0].deletedById).toBe(DELETED_USER_SENTINEL_ID);

      // Paired delete actor constraints satisfied (deletedById is not null)
      expect(tasks[0].deletedById).not.toBeNull();
      expect(taskAssets[0].deletedById).not.toBeNull();

      // Task asset survives with sentinel foreign keys
      expect(taskAssets[0].createdById).toBe(DELETED_USER_SENTINEL_ID);
      expect(taskAssets[0].deletedById).toBe(DELETED_USER_SENTINEL_ID);

      // Daily progress survives with sentinel foreign keys
      expect(progressUpdates[0].userId).toBe(DELETED_USER_SENTINEL_ID);
      expect(progressUpdates[0].correctedById).toBe(DELETED_USER_SENTINEL_ID);

      // Brand survives with createdById = null
      expect(brands[0].name).toBe("KIG Holding");
      expect(brands[0].createdById).toBeNull();

      // Audit logs survive with original actor UUIDs preserved (not rewritten to sentinel)
      expect(auditLogs[0].actorUserId).toBe(targetId);
      expect(auditLogs[1].action).toBe("DELETE_USER");
    });
  });

  describe("Audit Log Actor Fallback Presentation", () => {
    it("renders 'Người dùng đã xóa' when actorUserId has no corresponding user record", () => {
      const activeUsersMap = new Map<string, string>([
        ["user-live", "Nguyễn Văn A"],
      ]);

      function formatActorName(actorUserId: string | null): string {
        if (!actorUserId) return "Hệ thống";
        return activeUsersMap.get(actorUserId) ?? "Người dùng đã xóa";
      }

      expect(formatActorName("user-live")).toBe("Nguyễn Văn A");
      expect(formatActorName("deleted-user-uuid")).toBe("Người dùng đã xóa");
      expect(formatActorName(null)).toBe("Hệ thống");
    });
  });
});
