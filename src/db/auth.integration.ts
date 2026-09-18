import { randomBytes, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { expect, it } from "vitest";
import { createDatabase } from "./connection";
import { user, auditLog } from "./schema";
import { requireDevelopmentDatabase } from "../../scripts/database-env";
import { parseServerEnv } from "../lib/env-schema";
import { authHttp } from "../lib/auth/http";
import { userService } from "../lib/users/service";
import { usersHttp } from "../lib/users/http";
import { bootstrapHead } from "../lib/users/bootstrap";
import { createAuth } from "../lib/auth/factory";

it("proves authenticated HTTP restrictions, administration, password/audit rules and bootstrap rollback", async () => {
  const db = createDatabase(requireDevelopmentDatabase());
  const env = parseServerEnv(process.env);
  const passwords = [
    randomBytes(24).toString("base64url"),
    randomBytes(24).toString("base64url"),
    randomBytes(24).toString("base64url"),
  ];
  const namespace = randomUUID();
  const email = (label: string) => `${namespace}-${label}@example.invalid`;
  const rollback = new Error("rollback phase2 fixtures");
  try {
    const existingHeads = await db
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.role, "HEAD"), eq(user.banned, false)));
    expect(
      existingHeads,
      "This final-HEAD integration test requires an empty development account baseline.",
    ).toHaveLength(0);
    await expect(
      db.transaction(async (tx) => {
        const headId = await bootstrapHead(tx, env, {
          name: "Fixture HEAD",
          email: email("head"),
          password: passwords[0],
        });
        await expect(
          bootstrapHead(tx, env, {
            name: "Second bootstrap",
            email: email("second"),
            password: passwords[0],
          }),
        ).rejects.toThrow("ACTIVE HEAD already exists");
        const service = userService(tx, env);
        const internalAuth = createAuth(tx, env);
        await expect(
          internalAuth.api.signUpEmail({
            body: {
              name: "Denied",
              email: email("direct-signup"),
              password: passwords[0],
            },
          }),
        ).rejects.toThrow();
        const origin = new URL(env.BETTER_AUTH_URL).origin;
        function request(
          path: string,
          body?: unknown,
          cookie = "",
          sourceOrigin = origin,
        ) {
          return new Request(origin + path, {
            method: body === undefined ? "GET" : "POST",
            headers: {
              origin: sourceOrigin,
              cookie,
              "Content-Type": "application/json",
            },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          });
        }
        async function login(address: string, password: string) {
          const result = await authHttp(
            request("/api/auth/sign-in/email", { email: address, password }),
            tx,
            env,
          );
          expect(result.status).toBe(200);
          return result.headers
            .getSetCookie()
            .map((value) => value.split(";")[0])
            .join("; ");
        }
        const headCookie = await login(email("head"), passwords[0]);
        const headHeaders = request("/", undefined, headCookie).headers;
        expect(
          (
            await usersHttp(
              request(
                "/api/users",
                {
                  name: "Denied",
                  email: email("cross-origin"),
                  role: "EMPLOYEE",
                  password: passwords[0],
                },
                headCookie,
                "https://example.invalid",
              ),
              service,
              origin,
            )
          ).status,
        ).toBe(403);
        expect(
          (await usersHttp(request("/api/users"), service, origin)).status,
        ).toBe(401);
        expect(
          (
            await authHttp(
              request("/api/auth/sign-in/email", {
                email: email("head"),
                password: passwords[1],
              }),
              tx,
              env,
            )
          ).ok,
        ).toBe(false);
        expect(
          (
            await authHttp(
              request(
                "/api/auth/sign-in/email",
                { email: email("head"), password: passwords[0] },
                "",
                "https://example.invalid",
              ),
              tx,
              env,
            )
          ).status,
        ).toBe(403);
        const deputy = await service.create(headHeaders, {
          name: "Fixture DEPUTY",
          email: email("deputy"),
          role: "DEPUTY",
          password: passwords[1],
        });
        const employee = await service.create(headHeaders, {
          name: "Fixture EMPLOYEE",
          email: email("employee"),
          role: "EMPLOYEE",
          password: passwords[2],
        });
        await expect(
          service.create(headHeaders, {
            name: "Rejected HEAD",
            email: email("bad"),
            role: "HEAD",
            password: passwords[0],
          }),
        ).rejects.toThrow();
        for (const fixture of [
          { value: deputy, password: passwords[1] },
          { value: employee, password: passwords[2] },
        ]) {
          const cookie = await login(fixture.value.email, fixture.password);
          const headers = request("/", undefined, cookie).headers;
          await expect(
            internalAuth.api.changePassword({
              headers,
              body: {
                currentPassword: fixture.password,
                newPassword: passwords[0],
              },
            }),
          ).rejects.toMatchObject({ status: "FORBIDDEN" });
          expect(
            (
              await usersHttp(
                request("/api/users", undefined, cookie),
                service,
                origin,
              )
            ).status,
          ).toBe(403);
          await expect(
            service.create(headers, {
              name: "Denied",
              email: email("denied"),
              role: "EMPLOYEE",
              password: passwords[0],
            }),
          ).rejects.toMatchObject({ status: 403 });
          for (const command of [
            { operation: "change-role", role: "HEAD" },
            { operation: "disable" },
            { operation: "enable" },
            { operation: "reset-password", password: passwords[0] },
            { operation: "update", name: "Denied", email: email("denied") },
          ])
            expect(
              (
                await usersHttp(
                  request(`/api/users/${employee.id}`, command, cookie),
                  service,
                  origin,
                  employee.id,
                )
              ).status,
            ).toBe(403);
          expect(
            (
              await usersHttp(
                request(
                  "/api/users/own-password",
                  {
                    currentPassword: fixture.password,
                    newPassword: passwords[0],
                  },
                  cookie,
                ),
                service,
                origin,
                "own-password",
              )
            ).status,
          ).toBe(403);
          for (const path of [
            "/admin/create-user",
            "/admin/set-role",
            "/admin/ban-user",
            "/admin/set-user-password",
            "/admin/remove-user",
            "/change-password",
            "/update-user",
            "/change-email",
            "/delete-user",
            "/request-password-reset",
            "/reset-password",
          ])
            expect(
              (
                await authHttp(
                  request(
                    "/api/auth" + path,
                    {
                      userId: employee.id,
                      role: "HEAD",
                      banned: false,
                      name: "Denied",
                      email: email("denied"),
                      password: passwords[0],
                      currentPassword: fixture.password,
                      newPassword: passwords[0],
                    },
                    cookie,
                  ),
                  tx,
                  env,
                )
              ).status,
            ).toBe(403);
        }
        expect(
          (
            await authHttp(
              request("/api/auth/sign-up/email", {
                email: email("signup"),
                name: "Denied",
                password: passwords[0],
              }),
              tx,
              env,
            )
          ).status,
        ).toBe(403);
        expect(
          (
            await authHttp(
              request(
                "/api/auth/admin/remove-user",
                { userId: employee.id },
                headCookie,
              ),
              tx,
              env,
            )
          ).status,
        ).toBe(403);
        await expect(
          service.command(headHeaders, headId, { operation: "disable" }),
        ).rejects.toMatchObject({ status: 409 });
        await expect(
          service.command(headHeaders, headId, {
            operation: "change-role",
            role: "EMPLOYEE",
          }),
        ).rejects.toMatchObject({ status: 409 });
        for (const role of ["HEAD,EMPLOYEE", "admin"])
          await expect(
            service.command(headHeaders, employee.id, {
              operation: "change-role",
              role,
            }),
          ).rejects.toThrow();
        await service.command(headHeaders, employee.id, {
          operation: "update",
          name: "Updated",
          email: email("renamed"),
        });
        expect(
          (
            await authHttp(
              request("/api/auth/sign-in/email", {
                email: email("employee"),
                password: passwords[2],
              }),
              tx,
              env,
            )
          ).ok,
        ).toBe(false);
        const renamedCookie = await login(email("renamed"), passwords[2]);
        await service.command(headHeaders, employee.id, {
          operation: "disable",
        });
        expect(
          (
            await authHttp(
              request("/api/auth/sign-in/email", {
                email: email("renamed"),
                password: passwords[2],
              }),
              tx,
              env,
            )
          ).ok,
        ).toBe(false);
        expect(await service.list(headHeaders)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: employee.id, banned: true }),
          ]),
        );
        expect(
          await (
            await authHttp(
              request("/api/auth/get-session", undefined, renamedCookie),
              tx,
              env,
            )
          ).json(),
        ).toBeNull();
        await service.command(headHeaders, employee.id, {
          operation: "enable",
        });
        await login(email("renamed"), passwords[2]);
        await service.command(headHeaders, employee.id, {
          operation: "change-role",
          role: "HEAD",
        });
        await service.command(headHeaders, employee.id, {
          operation: "change-role",
          role: "EMPLOYEE",
        });
        await service.command(headHeaders, employee.id, {
          operation: "reset-password",
          password: passwords[1],
        });
        expect(
          (
            await authHttp(
              request("/api/auth/sign-in/email", {
                email: email("renamed"),
                password: passwords[2],
              }),
              tx,
              env,
            )
          ).ok,
        ).toBe(false);
        await login(email("renamed"), passwords[1]);
        await expect(
          service.changeOwnPassword(headHeaders, {
            currentPassword: passwords[2],
            newPassword: passwords[1],
          }),
        ).rejects.toThrow();
        await service.changeOwnPassword(headHeaders, {
          currentPassword: passwords[0],
          newPassword: passwords[1],
        });
        expect(
          await (
            await authHttp(
              request("/api/auth/get-session", undefined, headCookie),
              tx,
              env,
            )
          ).json(),
        ).toBeNull();
        const changedCookie = await login(email("head"), passwords[1]);
        expect(
          (
            await authHttp(
              request("/api/auth/sign-out", {}, changedCookie),
              tx,
              env,
            )
          ).status,
        ).toBe(200);
        expect(
          await (
            await authHttp(
              request("/api/auth/get-session", undefined, changedCookie),
              tx,
              env,
            )
          ).json(),
        ).toBeNull();
        const events = await tx
          .select()
          .from(auditLog)
          .where(eq(auditLog.actorUserId, headId));
        expect(events.map((row) => row.action)).toEqual(
          expect.arrayContaining([
            "LOGIN",
            "CREATE_USER",
            "UPDATE_USER",
            "DISABLE_USER",
            "ENABLE_USER",
            "CHANGE_ROLE",
            "RESET_PASSWORD",
            "CHANGE_OWN_PASSWORD",
          ]),
        );
        const payloads = JSON.stringify(events);
        expect(passwords.some((value) => payloads.includes(value))).toBe(false);
        expect(
          events.some((row) =>
            /password|hash|token/i.test(
              JSON.stringify([row.beforeData, row.afterData, row.metadata]),
            ),
          ),
        ).toBe(false);
        throw rollback;
      }),
    ).rejects.toBe(rollback);
    expect(await db.select().from(user)).toHaveLength(0);
  } finally {
    await db.$client.end();
  }
});
