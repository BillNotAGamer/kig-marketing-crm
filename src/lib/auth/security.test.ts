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

import { bootstrapSchema } from "../users/bootstrap";

describe("Phase 2 role and command validation", () => {
  it.each(userPermissions)("grants %s to ADMIN and HEAD", (permission) => {
    expect(hasPermission("ADMIN", permission)).toBe(true);
    expect(hasPermission("HEAD", permission)).toBe(true);
  });
  it("grants correct permissions to DEPUTY and EMPLOYEE", () => {
    for (const permission of [
      "user:create",
      "user:read",
      "user:update",
      "user:disable",
      "user:enable",
      "user:reset-password",
      "user:change-own-password",
    ] as const) {
      expect(hasPermission("DEPUTY", permission)).toBe(true);
    }
    expect(hasPermission("DEPUTY", "user:change-role")).toBe(false);

    expect(hasPermission("EMPLOYEE", "user:change-own-password")).toBe(true);
    for (const permission of [
      "user:create",
      "user:read",
      "user:update",
      "user:disable",
      "user:enable",
      "user:change-role",
      "user:reset-password",
    ] as const) {
      expect(hasPermission("EMPLOYEE", permission)).toBe(false);
    }
    for (const role of ["HEAD,EMPLOYEE", "admin", "SUPERADMIN", ""]) {
      for (const permission of userPermissions) {
        expect(hasPermission(role, permission)).toBe(false);
      }
    }
  });
  it("restricts schema creation and separates sensitive commands", () => {
    const input = {
      name: "Fixture",
      email: " FIXTURE@EXAMPLE.INVALID ",
      role: "EMPLOYEE",
      password: "x".repeat(6),
    };
    expect(createUserSchema.parse(input).email).toBe("fixture@example.invalid");
    expect(createUserSchema.safeParse({ ...input, role: "HEAD" }).success).toBe(
      true,
    );
    expect(
      createUserSchema.safeParse({ ...input, role: "ADMIN" }).success,
    ).toBe(true);
    expect(
      createUserSchema.safeParse({ ...input, role: "invalid" }).success,
    ).toBe(false);
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
  it("enforces explicit 6–128 length policy and fixed login routing", () => {
    // Exact boundary tests for passwordSchema
    expect(passwordSchema.safeParse("x".repeat(5)).success).toBe(false);
    expect(passwordSchema.safeParse("x".repeat(6)).success).toBe(true);
    expect(passwordSchema.safeParse("x".repeat(7)).success).toBe(true);
    expect(passwordSchema.safeParse("x".repeat(128)).success).toBe(true);
    expect(passwordSchema.safeParse("x".repeat(129)).success).toBe(false);

    // Whitespace only is rejected
    expect(passwordSchema.safeParse(" ".repeat(6)).success).toBe(false);
    expect(passwordSchema.safeParse(" \t\n ").success).toBe(false);

    // Leading and trailing spaces are preserved without trimming
    const untrimmed = "  pass67  ";
    expect(passwordSchema.safeParse(untrimmed).success).toBe(true);
    expect(passwordSchema.parse(untrimmed)).toBe(untrimmed);

    // Own password schema checks
    expect(
      ownPasswordSchema.safeParse({ newPassword: "x".repeat(6) }).success,
    ).toBe(false); // missing currentPassword
    expect(
      ownPasswordSchema.safeParse({
        currentPassword: "old-password",
        newPassword: "x".repeat(5),
      }).success,
    ).toBe(false);
    expect(
      ownPasswordSchema.safeParse({
        currentPassword: "old-password",
        newPassword: "x".repeat(6),
      }).success,
    ).toBe(true);

    // Reset password command checks
    expect(
      userCommandSchema.safeParse({
        operation: "reset-password",
        password: "x".repeat(5),
      }).success,
    ).toBe(false);
    expect(
      userCommandSchema.safeParse({
        operation: "reset-password",
        password: "x".repeat(6),
      }).success,
    ).toBe(true);

    // Bootstrap HEAD schema checks
    expect(
      bootstrapSchema.safeParse({
        name: "Head Admin",
        email: "head@kigholding.vn",
        password: "x".repeat(5),
      }).success,
    ).toBe(false);
    expect(
      bootstrapSchema.safeParse({
        name: "Head Admin",
        email: "head@kigholding.vn",
        password: "x".repeat(6),
      }).success,
    ).toBe(true);

    // Login schema remains permissive (min 1, max 128) with callback URL protection
    expect(
      loginSchema.safeParse({
        email: "fixture@example.invalid",
        password: "fixture",
        callbackURL: "https://example.invalid",
      }).success,
    ).toBe(false);
  });
});
