import { and, eq } from "drizzle-orm";
import { expect, it } from "vitest";
import { user } from "./schema";
import { authFixtures } from "../test/auth-fixtures";
import { createAuth } from "../lib/auth/factory";
import { userService } from "../lib/users/service";

it("serializes competing HEAD demotion/deactivation and keeps one ACTIVE HEAD", async () => {
  const fixture = await authFixtures();
  try {
    const db = fixture.db;
    const env = fixture.env;
    const service = userService(db, env);
    const auth = createAuth(db, env);
    async function headers(email: string) {
      const result = await auth.api.signInEmail({
        body: { email, password: fixture.password },
        asResponse: true,
      });
      expect(result.status).toBe(200);
      return new Headers({
        cookie: result.headers
          .getSetCookie()
          .map((value) => value.split(";")[0])
          .join("; "),
      });
    }
    const headHeaders = await headers(fixture.head.email);
    await service.command(headHeaders, fixture.deputy.id, {
      operation: "change-role",
      role: "HEAD",
    });
    const deputyHeaders = await headers(fixture.deputy.email);
    const before = await db
      .select()
      .from(user)
      .where(and(eq(user.role, "HEAD"), eq(user.banned, false)));
    expect(
      before,
      "Concurrency test requires exactly its two ACTIVE HEAD fixtures.",
    ).toHaveLength(2);
    const results = await Promise.allSettled([
      service.command(headHeaders, fixture.head.id, {
        operation: "change-role",
        role: "EMPLOYEE",
      }),
      service.command(deputyHeaders, fixture.deputy.id, {
        operation: "disable",
      }),
    ]);
    expect(
      results.filter((value) => value.status === "fulfilled"),
    ).toHaveLength(1);
    const rejected = results.find((value) => value.status === "rejected");
    expect(rejected?.status === "rejected" && rejected.reason.status).toBe(409);
    const active = await db
      .select()
      .from(user)
      .where(and(eq(user.role, "HEAD"), eq(user.banned, false)));
    expect(active).toHaveLength(1);
    const remainingHeaders =
      active[0].id === fixture.head.id ? headHeaders : deputyHeaders;
    await expect(
      service.command(remainingHeaders, active[0].id, { operation: "disable" }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      service.command(remainingHeaders, active[0].id, {
        operation: "change-role",
        role: "DEPUTY",
      }),
    ).rejects.toMatchObject({ status: 409 });
  } finally {
    await fixture.cleanup();
  }
});
