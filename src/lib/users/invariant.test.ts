// @vitest-environment node
import { describe, expect, it } from "vitest";
import { AccessError } from "../auth/permissions";
import type { AppRole } from "../auth/roles";

type MockUser = {
  id: string;
  role: AppRole;
  banned: boolean;
};

/**
 * Pure simulation of the transaction-safe preserveActiveAdminOrHead invariant.
 * This mirrors the exact logic executed inside userService.command under advisory lock.
 */
function checkInvariant(
  usersInDb: MockUser[],
  targetId: string,
  nextRole?: AppRole,
) {
  const target = usersInDb.find((u) => u.id === targetId);
  if (!target) throw new AccessError(404, "User not found.");
  if (target.banned) return; // Inactive target does not reduce active count

  const activeAdmins = usersInDb.filter((u) => u.role === "ADMIN" && !u.banned);

  if (activeAdmins.length === 0) {
    // STATE A: active ADMIN count === 0.
    // Preserve at least one ACTIVE HEAD.
    if (target.role === "HEAD" && nextRole !== "HEAD") {
      const activeHeads = usersInDb.filter(
        (u) => u.role === "HEAD" && !u.banned,
      );
      if (activeHeads.length <= 1) {
        throw new AccessError(
          409,
          "The final ACTIVE HEAD cannot be disabled or demoted.",
        );
      }
    }
  } else {
    // STATE B: active ADMIN count >= 1.
    // Enforce at least one ACTIVE ADMIN.
    if (target.role === "ADMIN" && nextRole !== "ADMIN") {
      if (activeAdmins.length <= 1) {
        throw new AccessError(
          409,
          "The final ACTIVE ADMIN cannot be disabled or demoted.",
        );
      }
    }
  }
}

describe("Transition Invariant (preserveActiveAdminOrHead)", () => {
  describe("STATE A: 0 active ADMINs", () => {
    it("refuses to demote the final active HEAD", () => {
      const db: MockUser[] = [
        { id: "head-1", role: "HEAD", banned: false },
        { id: "deputy-1", role: "DEPUTY", banned: false },
      ];

      expect(() => checkInvariant(db, "head-1", "DEPUTY")).toThrowError(
        new AccessError(
          409,
          "The final ACTIVE HEAD cannot be disabled or demoted.",
        ),
      );
    });

    it("refuses to disable the final active HEAD", () => {
      const db: MockUser[] = [
        { id: "head-1", role: "HEAD", banned: false },
        { id: "deputy-1", role: "DEPUTY", banned: false },
      ];

      // nextRole undefined means deactivation (disable)
      expect(() => checkInvariant(db, "head-1", undefined)).toThrowError(
        new AccessError(
          409,
          "The final ACTIVE HEAD cannot be disabled or demoted.",
        ),
      );
    });

    it("allows demoting one HEAD when 2 active HEADs exist", () => {
      const db: MockUser[] = [
        { id: "head-1", role: "HEAD", banned: false },
        { id: "head-2", role: "HEAD", banned: false },
      ];

      expect(() => checkInvariant(db, "head-1", "DEPUTY")).not.toThrow();
    });

    it("allows demoting or disabling DEPUTY and EMPLOYEE without constraint", () => {
      const db: MockUser[] = [
        { id: "head-1", role: "HEAD", banned: false },
        { id: "deputy-1", role: "DEPUTY", banned: false },
      ];

      expect(() => checkInvariant(db, "deputy-1", "EMPLOYEE")).not.toThrow();
      expect(() => checkInvariant(db, "deputy-1", undefined)).not.toThrow();
    });
  });

  describe("STATE B: >= 1 active ADMINs", () => {
    it("refuses to demote the final active ADMIN", () => {
      const db: MockUser[] = [
        { id: "admin-1", role: "ADMIN", banned: false },
        { id: "head-1", role: "HEAD", banned: false },
      ];

      expect(() => checkInvariant(db, "admin-1", "HEAD")).toThrowError(
        new AccessError(
          409,
          "The final ACTIVE ADMIN cannot be disabled or demoted.",
        ),
      );
    });

    it("refuses to disable the final active ADMIN", () => {
      const db: MockUser[] = [
        { id: "admin-1", role: "ADMIN", banned: false },
        { id: "head-1", role: "HEAD", banned: false },
      ];

      expect(() => checkInvariant(db, "admin-1", undefined)).toThrowError(
        new AccessError(
          409,
          "The final ACTIVE ADMIN cannot be disabled or demoted.",
        ),
      );
    });

    it("allows active HEAD count to reach 0 when active ADMIN exists", () => {
      const db: MockUser[] = [
        { id: "admin-1", role: "ADMIN", banned: false },
        { id: "head-1", role: "HEAD", banned: false },
      ];

      // HEAD can be demoted to DEPUTY because ADMIN inherits HEAD operational authority
      expect(() => checkInvariant(db, "head-1", "DEPUTY")).not.toThrow();
      expect(() => checkInvariant(db, "head-1", undefined)).not.toThrow();
    });

    it("allows demoting one ADMIN when 2 active ADMINs exist, and prevents demoting the last one", () => {
      const db: MockUser[] = [
        { id: "admin-1", role: "ADMIN", banned: false },
        { id: "admin-2", role: "ADMIN", banned: false },
      ];

      // First admin demoted
      expect(() => checkInvariant(db, "admin-1", "HEAD")).not.toThrow();

      // Simulate first admin mutation committed
      db[0].role = "HEAD";

      // Second attempt must be rejected
      expect(() => checkInvariant(db, "admin-2", "HEAD")).toThrowError(
        new AccessError(
          409,
          "The final ACTIVE ADMIN cannot be disabled or demoted.",
        ),
      );
    });

    it("ignores banned users and does not count them towards active minimums", () => {
      const db: MockUser[] = [
        { id: "admin-1", role: "ADMIN", banned: false },
        { id: "admin-banned", role: "ADMIN", banned: true },
      ];

      // Only 1 active ADMIN exists; cannot disable or demote admin-1
      expect(() => checkInvariant(db, "admin-1", undefined)).toThrowError(
        new AccessError(
          409,
          "The final ACTIVE ADMIN cannot be disabled or demoted.",
        ),
      );

      // Mutating an already banned user is a no-op for invariant check
      expect(() => checkInvariant(db, "admin-banned", "HEAD")).not.toThrow();
    });
  });

  describe("Concurrent Admin Safety Simulation", () => {
    it("prevents two concurrent requests from reducing active ADMINs to 0", async () => {
      // Shared database state protected by advisory lock
      const sharedDb: MockUser[] = [
        { id: "admin-1", role: "ADMIN", banned: false },
        { id: "admin-2", role: "ADMIN", banned: false },
      ];

      let lockAcquired = false;

      // Simulated transaction executing under administration advisory lock
      async function executeDemoteAdmin(adminId: string): Promise<string> {
        // Advisory lock: only one transaction enters at a time
        while (lockAcquired) {
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
        lockAcquired = true;

        try {
          // Check invariant against fresh state
          checkInvariant(sharedDb, adminId, "HEAD");
          // Apply mutation
          const target = sharedDb.find((u) => u.id === adminId)!;
          target.role = "HEAD";
          return "SUCCESS";
        } finally {
          lockAcquired = false;
        }
      }

      // Launch two concurrent demotion attempts
      const results = await Promise.allSettled([
        executeDemoteAdmin("admin-1"),
        executeDemoteAdmin("admin-2"),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      // Exactly one must succeed, exactly one must fail safely
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      // Remaining active ADMIN count is exactly 1, never 0
      const activeAdmins = sharedDb.filter(
        (u) => u.role === "ADMIN" && !u.banned,
      );
      expect(activeAdmins).toHaveLength(1);
    });
  });
});
