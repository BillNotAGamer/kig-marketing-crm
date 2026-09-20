// @vitest-environment node
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { requireAdminPromotionDatabase } from "../../../scripts/database-env";
import {
  checkPromotionReadiness,
  executePromotion,
} from "../../../scripts/lib/promote";
import { administrationLock } from "../users/locks";
import type { ScriptDatabase } from "../../../scripts/lib/database";

describe("promote-first-admin CLI architecture and safeguards", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("ensures promotion CLI files do NOT import src/db/index.ts or server-only", () => {
    const root = process.cwd();
    const filesToCheck = [
      path.join(root, "scripts", "promote-first-admin.ts"),
      path.join(root, "scripts", "lib", "promote.ts"),
      path.join(root, "scripts", "lib", "database.ts"),
      path.join(root, "src", "lib", "users", "locks.ts"),
    ];

    for (const filePath of filesToCheck) {
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, "utf8");
      expect(content).not.toMatch(/from\s+["'].*\/src\/db["']/);
      expect(content).not.toMatch(/from\s+["']@\/db["']/);
      expect(content).not.toMatch(/import\s+["']server-only["']/);
    }
  });

  it("can load scripts/lib/promote in Node environment without server-only error", async () => {
    const promoteModule = await import("../../../scripts/lib/promote");
    expect(promoteModule.checkPromotionReadiness).toBeDefined();
    expect(promoteModule.executePromotion).toBeDefined();
  });

  it("fails closed when KIG_DATABASE_ENV is not production", () => {
    delete process.env.KIG_DATABASE_ENV;
    expect(() => requireAdminPromotionDatabase()).toThrow(
      /Admin promotion command requires explicit KIG_DATABASE_ENV=production authorization/,
    );

    process.env.KIG_DATABASE_ENV = "development";
    expect(() => requireAdminPromotionDatabase()).toThrow(
      /Admin promotion command requires explicit KIG_DATABASE_ENV=production authorization/,
    );
  });

  it("fails closed when production promotion opt-in flag is missing in mutation mode", () => {
    process.env.KIG_DATABASE_ENV = "production";
    delete process.env.KIG_ALLOW_PRODUCTION_ADMIN_PROMOTION;
    process.env.DATABASE_URL = "postgres://user:password@127.0.0.1:5432/testdb";

    expect(() => requireAdminPromotionDatabase()).toThrow(
      /Production admin promotion requires explicit one-time KIG_ALLOW_PRODUCTION_ADMIN_PROMOTION=true opt-in/,
    );
  });

  it("allows read-only --check mode without KIG_ALLOW_PRODUCTION_ADMIN_PROMOTION flag", () => {
    process.env.KIG_DATABASE_ENV = "production";
    delete process.env.KIG_ALLOW_PRODUCTION_ADMIN_PROMOTION;
    process.env.DATABASE_URL = "postgres://user:password@127.0.0.1:5432/testdb";

    const url = requireAdminPromotionDatabase({ allowReadOnlyCheck: true });
    expect(url).toBe("postgres://user:password@127.0.0.1:5432/testdb");
  });

  it("checkPromotionReadiness correctly assesses ready state when 0 ADMINs and >=1 active HEAD", async () => {
    const mockDb = {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => ({
          where: vi.fn().mockImplementation(() => {
            // Check condition to mock different counts
            return Promise.resolve([{ count: 0 }]); // active ADMIN = 0 by default
          }),
          then: (resolve: (val: unknown) => unknown) =>
            Promise.resolve([{ count: 3 }]).then(resolve),
        })),
      })),
    } as unknown as ScriptDatabase;

    // Custom mock to return expected counts
    let selectCallIndex = 0;
    mockDb.select = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => {
          selectCallIndex++;
          if (selectCallIndex === 1) return Promise.resolve([{ count: 0 }]); // active ADMIN = 0
          if (selectCallIndex === 2) return Promise.resolve([{ count: 1 }]); // active HEAD = 1
          if (selectCallIndex === 3) return Promise.resolve([{ count: 1 }]); // active DEPUTY = 1
          if (selectCallIndex === 4) return Promise.resolve([{ count: 0 }]); // active EMPLOYEE = 0
          if (selectCallIndex === 5) return Promise.resolve([{ count: 1 }]); // banned = 1
          return Promise.resolve([{ count: 0 }]);
        }),
        then: (resolve: (val: unknown) => unknown) =>
          Promise.resolve([{ count: 3 }]).then(resolve), // total users = 3
      }),
    });

    const result = await checkPromotionReadiness(mockDb);
    expect(result.totalUsers).toBe(3);
    expect(result.activeAdmins).toBe(0);
    expect(result.activeHeads).toBe(1);
    expect(result.activeDeputies).toBe(1);
    expect(result.activeEmployees).toBe(0);
    expect(result.bannedUsers).toBe(1);
    expect(result.isReady).toBe(true);
  });

  it("checkPromotionReadiness reports not ready if active ADMIN already exists", async () => {
    let selectCallIndex = 0;
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => {
            selectCallIndex++;
            if (selectCallIndex === 1) return Promise.resolve([{ count: 1 }]); // active ADMIN = 1!
            if (selectCallIndex === 2) return Promise.resolve([{ count: 1 }]); // active HEAD = 1
            return Promise.resolve([{ count: 0 }]);
          }),
          then: (resolve: (val: unknown) => unknown) =>
            Promise.resolve([{ count: 3 }]).then(resolve),
        }),
      }),
    } as unknown as ScriptDatabase;

    const result = await checkPromotionReadiness(mockDb);
    expect(result.activeAdmins).toBe(1);
    expect(result.isReady).toBe(false);
  });

  it("executePromotion refuses if active ADMIN already exists", async () => {
    const executedQueries: unknown[] = [];
    const mockTx = {
      execute: vi.fn().mockImplementation((query) => {
        executedQueries.push(query);
        return Promise.resolve();
      }),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 1 }]), // active ADMIN = 1!
        }),
      }),
    };

    const mockDb = {
      transaction: vi.fn().mockImplementation(async (callback) => {
        return callback(mockTx);
      }),
    } as unknown as ScriptDatabase;

    await expect(
      executePromotion(mockDb, "target@example.com"),
    ).rejects.toThrow(/Active ADMIN already exists/);

    expect(executedQueries).toContain(administrationLock);
  });

  it("executePromotion refuses if target user is not found", async () => {
    let selectCall = 0;
    const mockTx = {
      execute: vi.fn().mockResolvedValue(undefined),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => {
            selectCall++;
            if (selectCall === 1) return Promise.resolve([{ count: 0 }]); // active ADMIN = 0
            return Promise.resolve([]); // target not found
          }),
        }),
      }),
    };

    const mockDb = {
      transaction: vi.fn().mockImplementation(async (callback) => {
        return callback(mockTx);
      }),
    } as unknown as ScriptDatabase;

    await expect(
      executePromotion(mockDb, "notfound@example.com"),
    ).rejects.toThrow(/Target user not found/);
  });

  it("executePromotion refuses if target user is banned", async () => {
    let selectCall = 0;
    const mockTx = {
      execute: vi.fn().mockResolvedValue(undefined),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => {
            selectCall++;
            if (selectCall === 1) return Promise.resolve([{ count: 0 }]); // active ADMIN = 0
            return Promise.resolve([
              {
                id: "user-1",
                email: "banned@example.com",
                role: "HEAD",
                banned: true,
              },
            ]);
          }),
        }),
      }),
    };

    const mockDb = {
      transaction: vi.fn().mockImplementation(async (callback) => {
        return callback(mockTx);
      }),
    } as unknown as ScriptDatabase;

    await expect(
      executePromotion(mockDb, "banned@example.com"),
    ).rejects.toThrow(/Target user is inactive\/banned/);
  });

  it("executePromotion refuses if target user role is not HEAD", async () => {
    let selectCall = 0;
    const mockTx = {
      execute: vi.fn().mockResolvedValue(undefined),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => {
            selectCall++;
            if (selectCall === 1) return Promise.resolve([{ count: 0 }]); // active ADMIN = 0
            return Promise.resolve([
              {
                id: "user-2",
                email: "deputy@example.com",
                role: "DEPUTY",
                banned: false,
              },
            ]);
          }),
        }),
      }),
    };

    const mockDb = {
      transaction: vi.fn().mockImplementation(async (callback) => {
        return callback(mockTx);
      }),
    } as unknown as ScriptDatabase;

    await expect(
      executePromotion(mockDb, "deputy@example.com"),
    ).rejects.toThrow(/Promotion is restricted to active HEAD accounts only/);
  });

  it("executePromotion successfully executes atomic promotion with audit and session revocation", async () => {
    let selectCall = 0;
    const updateSpy = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    const insertSpy = vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });
    const deleteSpy = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });

    const mockTx = {
      execute: vi.fn().mockResolvedValue(undefined),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => {
            selectCall++;
            if (selectCall === 1) return Promise.resolve([{ count: 0 }]); // active ADMIN = 0
            return Promise.resolve([
              {
                id: "target-head-uuid",
                name: "Head User",
                email: "head@example.com",
                role: "HEAD",
                banned: false,
                createdAt: new Date("2026-01-01"),
              },
            ]);
          }),
        }),
      }),
      update: updateSpy,
      insert: insertSpy,
      delete: deleteSpy,
    };

    const mockDb = {
      transaction: vi.fn().mockImplementation(async (callback) => {
        return callback(mockTx);
      }),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 1 }]), // post-commit active ADMIN = 1
        }),
      }),
    } as unknown as ScriptDatabase;

    const result = await executePromotion(mockDb, "head@example.com");

    expect(result.targetId).toBe("target-head-uuid");
    expect(result.activeAdmins).toBe(1);
    expect(mockTx.execute).toHaveBeenCalledWith(administrationLock);
    expect(updateSpy).toHaveBeenCalled();
    expect(insertSpy).toHaveBeenCalled();
    expect(deleteSpy).toHaveBeenCalled();
  });
});
