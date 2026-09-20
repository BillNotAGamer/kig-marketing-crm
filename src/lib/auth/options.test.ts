// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { authOptions } from "./options";
import { createAuth } from "./factory";
import { authRoles, headUserActions } from "./roles";
import { user, session, account, verification } from "@/db/schema/auth";
import { getTableConfig } from "drizzle-orm/pg-core";
import { normalizeAuthSchema } from "../../../scripts/normalize-auth-schema";
import { format } from "prettier";

const fixture = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Schema fixture",
  email: "schema@example.invalid",
  emailVerified: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("Better Auth persistence configuration", () => {
  it("enables email/password, disables public signup/deletion and configures UUID", () => {
    expect(authOptions.emailAndPassword).toEqual({
      enabled: true,
      disableSignUp: true,
    });
    expect(authOptions.user.deleteUser.enabled).toBe(false);
    expect(authOptions.advanced.database.generateId).toBe("uuid");
    const options = authOptions.plugins[0].options!;
    expect(options.defaultRole).toBe("EMPLOYEE");
    expect(options.adminRoles).toEqual(["HEAD"]);
    expect(options).not.toHaveProperty("adminUserIds");
    expect(Object.keys(authRoles)).toEqual(["HEAD", "DEPUTY", "EMPLOYEE"]);
  });
  it("configures Better Auth with minPasswordLength: 6 and maxPasswordLength: 128", () => {
    const auth = createAuth(
      {} as never,
      {
        BETTER_AUTH_SECRET: "a".repeat(32),
        BETTER_AUTH_URL: "http://localhost:3000",
      } as never,
    );
    expect(auth.options.emailAndPassword?.minPasswordLength).toBe(6);
    expect(auth.options.emailAndPassword?.maxPasswordLength).toBe(128);
  });
  it("HEAD has only eight enumerated user actions; forbidden user/session actions are denied", () => {
    for (const action of headUserActions)
      expect(authRoles.HEAD.authorize({ user: [action] }).success).toBe(true);
    for (const action of [
      "delete",
      "impersonate",
      "impersonate-admins",
    ] as const)
      expect(authRoles.HEAD.authorize({ user: [action] }).success).toBe(false);
    for (const role of [authRoles.DEPUTY, authRoles.EMPLOYEE])
      for (const action of headUserActions)
        expect(role.authorize({ user: [action] }).success).toBe(false);
    for (const role of Object.values(authRoles))
      expect(
        role.authorize({ session: ["delete", "list", "revoke"] }).success,
      ).toBe(false);
  });
  it("generates all four UUID auth models and canonical non-null role/ban defaults", () => {
    expect(
      [user, session, account, verification].map((t) => getTableConfig(t).name),
    ).toEqual(["user", "session", "account", "verification"]);
    for (const table of [user, session, account, verification])
      expect(table.id.getSQLType()).toBe("uuid");
    expect(session.userId.getSQLType()).toBe("uuid");
    expect(account.userId.getSQLType()).toBe("uuid");
    expect(user.role.default).toBe("EMPLOYEE");
    expect(user.role.notNull).toBe(true);
    expect(user.banned.default).toBe(false);
    expect(user.banned.notNull).toBe(true);
    const names = getTableConfig(user).columns.map((c) => c.name);
    expect(names).toEqual(
      expect.arrayContaining(["role", "banned", "ban_reason", "ban_expires"]),
    );
    for (const invalid of ["is_active", "status", "deleted_at", "active"])
      expect(names).not.toContain(invalid);
  });
  it.each([
    "",
    "admin",
    "user",
    "manager",
    "superadmin",
    "HEAD,EMPLOYEE",
    "HEAD,DEPUTY",
    ["HEAD", "EMPLOYEE"],
  ])("rejects invalid/multiple role %j in user-write hooks", async (role) => {
    await expect(
      authOptions.databaseHooks.user.create.before({ ...fixture, role }),
    ).rejects.toMatchObject({ status: "BAD_REQUEST" });
    await expect(
      authOptions.databaseHooks.user.update.before({ role }),
    ).rejects.toMatchObject({ status: "BAD_REQUEST" });
  });
  it.each(["HEAD", "DEPUTY", "EMPLOYEE"])(
    "accepts single canonical role %s",
    async (role) => {
      await expect(
        authOptions.databaseHooks.user.create.before({ ...fixture, role }),
      ).resolves.toBeUndefined();
      await expect(
        authOptions.databaseHooks.user.update.before({ role }),
      ).resolves.toBeUndefined();
    },
  );
  it("retains CLI output and repeatably normalizes only approved persistence details", async () => {
    const raw = readFileSync("src/db/schema/auth.generated.ts", "utf8");
    const result = await format(normalizeAuthSchema(raw), {
      parser: "typescript",
    });
    expect(result).toBe(readFileSync("src/db/schema/auth.ts", "utf8"));
    expect(() => normalizeAuthSchema("unexpected generator output")).toThrow(
      "Unexpected Better Auth schema format",
    );
  });
});
