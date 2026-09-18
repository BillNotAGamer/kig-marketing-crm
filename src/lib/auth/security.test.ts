// @vitest-environment node
import { describe, expect, it } from "vitest";
import { hasPermission, userPermissions } from "./permissions";
import {
  createUserSchema,
  userCommandSchema,
  ownPasswordSchema,
  loginSchema,
  passwordSchema,
} from "./validation";

describe("Phase 2 role and command validation", () => {
  it.each(userPermissions)("grants %s only to HEAD", (permission) => {
    expect(hasPermission("HEAD", permission)).toBe(true);
    for (const role of ["DEPUTY", "EMPLOYEE", "HEAD,EMPLOYEE", "ADMIN", ""])
      expect(hasPermission(role, permission)).toBe(false);
  });
  it("restricts normal creation to DEPUTY/EMPLOYEE and separates sensitive commands", () => {
    const input = {
      name: "Fixture",
      email: " FIXTURE@EXAMPLE.INVALID ",
      role: "EMPLOYEE",
      password: "x".repeat(12),
    };
    expect(createUserSchema.parse(input).email).toBe("fixture@example.invalid");
    expect(createUserSchema.safeParse({ ...input, role: "HEAD" }).success).toBe(
      false,
    );
    expect(createUserSchema.safeParse({ ...input, banned: true }).success).toBe(
      false,
    );
    for (const role of ["HEAD,DEPUTY", ["HEAD"], "admin"])
      expect(
        userCommandSchema.safeParse({ operation: "change-role", role }).success,
      ).toBe(false);
    expect(
      userCommandSchema.safeParse({
        operation: "update",
        name: "Fixture",
        email: "fixture@example.invalid",
        role: "HEAD",
      }).success,
    ).toBe(false);
    expect(
      userCommandSchema.safeParse({ operation: "disable", banExpiresIn: 10 })
        .success,
    ).toBe(false);
    expect(userCommandSchema.safeParse({ operation: "delete" }).success).toBe(
      false,
    );
  });
  it("enforces explicit length policy and fixed login routing", () => {
    for (const value of ["x".repeat(11), "x".repeat(129), " ".repeat(12)])
      expect(passwordSchema.safeParse(value).success).toBe(false);
    expect(
      ownPasswordSchema.safeParse({ newPassword: "x".repeat(12) }).success,
    ).toBe(false);
    expect(
      loginSchema.safeParse({
        email: "fixture@example.invalid",
        password: "fixture",
        callbackURL: "https://example.invalid",
      }).success,
    ).toBe(false);
  });
});
