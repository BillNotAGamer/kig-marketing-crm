// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  canCreateRole,
  allowedCreationRoles,
  canViewManagedUser,
  canManageTarget,
  canEditIdentity,
  canAssignRole,
  canDisableUser,
  canEnableUser,
  canResetPassword,
} from "./policy";
import { appRoleValues, type AppRole } from "../auth/roles";
import { permitsTask, canAssignTask } from "../tasks/policy";
import { canAddAsset, canRemoveAsset } from "../assets/model";
import { canCreateBrand, canReadBrands } from "../brands/policy";
import type { Actor } from "../auth/session-core";

function makeActor(role: AppRole, id = "actor-id"): Actor {
  return { id, role, name: "Actor", email: `${role.toLowerCase()}@kig.vn` };
}

describe("Role Creation Matrix (canCreateRole & allowedCreationRoles)", () => {
  it("allows ADMIN to create all canonical roles", () => {
    for (const role of appRoleValues) {
      expect(canCreateRole("ADMIN", role)).toBe(true);
    }
    expect(allowedCreationRoles("ADMIN")).toEqual([
      "ADMIN",
      "HEAD",
      "DEPUTY",
      "EMPLOYEE",
    ]);
  });

  it("allows HEAD to create only DEPUTY and EMPLOYEE", () => {
    expect(canCreateRole("HEAD", "DEPUTY")).toBe(true);
    expect(canCreateRole("HEAD", "EMPLOYEE")).toBe(true);
    expect(canCreateRole("HEAD", "ADMIN")).toBe(false);
    expect(canCreateRole("HEAD", "HEAD")).toBe(false);
    expect(allowedCreationRoles("HEAD")).toEqual(["DEPUTY", "EMPLOYEE"]);
  });

  it("allows DEPUTY to create only EMPLOYEE", () => {
    expect(canCreateRole("DEPUTY", "EMPLOYEE")).toBe(true);
    expect(canCreateRole("DEPUTY", "DEPUTY")).toBe(false);
    expect(canCreateRole("DEPUTY", "HEAD")).toBe(false);
    expect(canCreateRole("DEPUTY", "ADMIN")).toBe(false);
    expect(allowedCreationRoles("DEPUTY")).toEqual(["EMPLOYEE"]);
  });

  it("forbids EMPLOYEE from creating any role", () => {
    for (const role of appRoleValues) {
      expect(canCreateRole("EMPLOYEE", role)).toBe(false);
    }
    expect(allowedCreationRoles("EMPLOYEE")).toEqual([]);
  });
});

describe("User Visibility Matrix (canViewManagedUser)", () => {
  const adminActor = makeActor("ADMIN", "admin-1");
  const headActor = makeActor("HEAD", "head-1");
  const deputyActor = makeActor("DEPUTY", "deputy-1");
  const employeeActor = makeActor("EMPLOYEE", "emp-1");

  const adminTarget = { id: "admin-2", role: "ADMIN" };
  const headTarget = { id: "head-2", role: "HEAD" };
  const deputyTarget = { id: "deputy-2", role: "DEPUTY" };
  const employeeTarget = { id: "emp-2", role: "EMPLOYEE" };

  it("allows ADMIN to view all users", () => {
    expect(canViewManagedUser(adminActor, adminActor)).toBe(true);
    expect(canViewManagedUser(adminActor, adminTarget)).toBe(true);
    expect(canViewManagedUser(adminActor, headTarget)).toBe(true);
    expect(canViewManagedUser(adminActor, deputyTarget)).toBe(true);
    expect(canViewManagedUser(adminActor, employeeTarget)).toBe(true);
  });

  it("allows HEAD to view self, DEPUTY, and EMPLOYEE; hides ADMIN and peer HEAD", () => {
    expect(canViewManagedUser(headActor, headActor)).toBe(true);
    expect(canViewManagedUser(headActor, deputyTarget)).toBe(true);
    expect(canViewManagedUser(headActor, employeeTarget)).toBe(true);
    // IDOR protection: cannot view ADMIN or peer HEAD
    expect(canViewManagedUser(headActor, adminTarget)).toBe(false);
    expect(canViewManagedUser(headActor, headTarget)).toBe(false);
  });

  it("allows DEPUTY to view EMPLOYEE only; hides ADMIN, HEAD, peer DEPUTY, and self", () => {
    expect(canViewManagedUser(deputyActor, employeeTarget)).toBe(true);
    expect(canViewManagedUser(deputyActor, adminTarget)).toBe(false);
    expect(canViewManagedUser(deputyActor, headTarget)).toBe(false);
    expect(canViewManagedUser(deputyActor, deputyTarget)).toBe(false);
    expect(canViewManagedUser(deputyActor, deputyActor)).toBe(false);
  });

  it("forbids EMPLOYEE from viewing any users", () => {
    for (const target of [
      adminTarget,
      headTarget,
      deputyTarget,
      employeeTarget,
      employeeActor,
    ]) {
      expect(canViewManagedUser(employeeActor, target)).toBe(false);
    }
  });
});

describe("Management Authority Matrix (canManageTarget & canEditIdentity)", () => {
  const admin = makeActor("ADMIN", "admin-1");
  const head = makeActor("HEAD", "head-1");
  const deputy = makeActor("DEPUTY", "deputy-1");
  const employee = makeActor("EMPLOYEE", "emp-1");

  const targets = {
    admin: { id: "admin-2", role: "ADMIN" },
    head: { id: "head-2", role: "HEAD" },
    deputy: { id: "deputy-2", role: "DEPUTY" },
    employee: { id: "emp-2", role: "EMPLOYEE" },
  };

  it("ADMIN can manage all targets and self", () => {
    expect(canManageTarget(admin, admin)).toBe(true);
    expect(canManageTarget(admin, targets.admin)).toBe(true);
    expect(canManageTarget(admin, targets.head)).toBe(true);
    expect(canManageTarget(admin, targets.deputy)).toBe(true);
    expect(canManageTarget(admin, targets.employee)).toBe(true);

    expect(canEditIdentity(admin, targets.admin)).toBe(true);
    expect(canEditIdentity(admin, admin)).toBe(true);
  });

  it("HEAD can manage subordinates and self, but not ADMIN or peer HEAD", () => {
    expect(canManageTarget(head, head)).toBe(true);
    expect(canManageTarget(head, targets.deputy)).toBe(true);
    expect(canManageTarget(head, targets.employee)).toBe(true);
    expect(canManageTarget(head, targets.admin)).toBe(false);
    expect(canManageTarget(head, targets.head)).toBe(false);

    expect(canEditIdentity(head, head)).toBe(true);
    expect(canEditIdentity(head, targets.deputy)).toBe(true);
    expect(canEditIdentity(head, targets.employee)).toBe(true);
    expect(canEditIdentity(head, targets.admin)).toBe(false);
    expect(canEditIdentity(head, targets.head)).toBe(false);
  });

  it("DEPUTY can manage EMPLOYEE only", () => {
    expect(canManageTarget(deputy, targets.employee)).toBe(true);
    expect(canManageTarget(deputy, targets.admin)).toBe(false);
    expect(canManageTarget(deputy, targets.head)).toBe(false);
    expect(canManageTarget(deputy, targets.deputy)).toBe(false);
    expect(canManageTarget(deputy, deputy)).toBe(false);

    expect(canEditIdentity(deputy, targets.employee)).toBe(true);
    expect(canEditIdentity(deputy, targets.deputy)).toBe(false);
  });

  it("EMPLOYEE cannot manage anyone", () => {
    expect(canManageTarget(employee, employee)).toBe(false);
    expect(canManageTarget(employee, targets.employee)).toBe(false);
    expect(canEditIdentity(employee, employee)).toBe(false);
  });
});

describe("Role Assignment Matrix (canAssignRole)", () => {
  const admin = makeActor("ADMIN", "admin-1");
  const head = makeActor("HEAD", "head-1");
  const deputy = makeActor("DEPUTY", "deputy-1");
  const employee = makeActor("EMPLOYEE", "emp-1");

  const subordinateDeputy = { id: "deputy-2", role: "DEPUTY" };
  const subordinateEmployee = { id: "emp-2", role: "EMPLOYEE" };
  const peerHead = { id: "head-2", role: "HEAD" };
  const targetAdmin = { id: "admin-2", role: "ADMIN" };

  it("ADMIN can assign any role to any manageable user, including self", () => {
    for (const role of appRoleValues) {
      expect(canAssignRole(admin, subordinateDeputy, role)).toBe(true);
      expect(canAssignRole(admin, admin, role)).toBe(true);
      expect(canAssignRole(admin, peerHead, role)).toBe(true);
    }
  });

  it("HEAD can only move subordinates between DEPUTY and EMPLOYEE", () => {
    // Valid moves
    expect(canAssignRole(head, subordinateDeputy, "EMPLOYEE")).toBe(true);
    expect(canAssignRole(head, subordinateEmployee, "DEPUTY")).toBe(true);
    expect(canAssignRole(head, subordinateDeputy, "DEPUTY")).toBe(true);
    expect(canAssignRole(head, subordinateEmployee, "EMPLOYEE")).toBe(true);

    // Forbidden privilege escalations
    expect(canAssignRole(head, subordinateDeputy, "ADMIN")).toBe(false);
    expect(canAssignRole(head, subordinateDeputy, "HEAD")).toBe(false);
    expect(canAssignRole(head, subordinateEmployee, "ADMIN")).toBe(false);
    expect(canAssignRole(head, subordinateEmployee, "HEAD")).toBe(false);

    // Cannot target peer HEAD or ADMIN
    expect(canAssignRole(head, peerHead, "EMPLOYEE")).toBe(false);
    expect(canAssignRole(head, targetAdmin, "EMPLOYEE")).toBe(false);

    // HEAD CANNOT change own role
    expect(canAssignRole(head, head, "ADMIN")).toBe(false);
    expect(canAssignRole(head, head, "DEPUTY")).toBe(false);
    expect(canAssignRole(head, head, "HEAD")).toBe(false);
  });

  it("DEPUTY cannot assign any roles", () => {
    for (const role of appRoleValues) {
      expect(canAssignRole(deputy, subordinateEmployee, role)).toBe(false);
      expect(canAssignRole(deputy, deputy, role)).toBe(false);
      expect(canAssignRole(deputy, targetAdmin, role)).toBe(false);
    }
  });

  it("EMPLOYEE cannot assign any roles", () => {
    for (const role of appRoleValues) {
      expect(canAssignRole(employee, subordinateEmployee, role)).toBe(false);
    }
  });
});

describe("Disable and Enable Matrix (canDisableUser & canEnableUser)", () => {
  const admin = makeActor("ADMIN", "admin-1");
  const head = makeActor("HEAD", "head-1");
  const deputy = makeActor("DEPUTY", "deputy-1");

  const targets = {
    admin: { id: "admin-2", role: "ADMIN" },
    head: { id: "head-2", role: "HEAD" },
    deputy: { id: "deputy-2", role: "DEPUTY" },
    employee: { id: "emp-2", role: "EMPLOYEE" },
  };

  it("ADMIN can disable/enable all users including self-disable", () => {
    expect(canDisableUser(admin, targets.admin)).toBe(true);
    expect(canDisableUser(admin, targets.head)).toBe(true);
    expect(canDisableUser(admin, targets.deputy)).toBe(true);
    expect(canDisableUser(admin, targets.employee)).toBe(true);
    expect(canDisableUser(admin, admin)).toBe(true);

    expect(canEnableUser(admin, targets.admin)).toBe(true);
    expect(canEnableUser(admin, admin)).toBe(false); // cannot self-enable
  });

  it("HEAD can disable/enable DEPUTY and EMPLOYEE only", () => {
    expect(canDisableUser(head, targets.deputy)).toBe(true);
    expect(canDisableUser(head, targets.employee)).toBe(true);
    expect(canDisableUser(head, targets.admin)).toBe(false);
    expect(canDisableUser(head, targets.head)).toBe(false);

    expect(canEnableUser(head, targets.deputy)).toBe(true);
    expect(canEnableUser(head, targets.employee)).toBe(true);
    expect(canEnableUser(head, targets.admin)).toBe(false);
    expect(canEnableUser(head, targets.head)).toBe(false);
  });

  it("DEPUTY can disable/enable EMPLOYEE only", () => {
    expect(canDisableUser(deputy, targets.employee)).toBe(true);
    expect(canDisableUser(deputy, targets.deputy)).toBe(false);
    expect(canDisableUser(deputy, targets.head)).toBe(false);
    expect(canDisableUser(deputy, targets.admin)).toBe(false);

    expect(canEnableUser(deputy, targets.employee)).toBe(true);
    expect(canEnableUser(deputy, targets.deputy)).toBe(false);
  });
});

describe("Password Reset Matrix (canResetPassword)", () => {
  const admin = makeActor("ADMIN", "admin-1");
  const head = makeActor("HEAD", "head-1");
  const deputy = makeActor("DEPUTY", "deputy-1");
  const employee = makeActor("EMPLOYEE", "emp-1");

  const targets = {
    admin: { id: "admin-2", role: "ADMIN" },
    head: { id: "head-2", role: "HEAD" },
    deputy: { id: "deputy-2", role: "DEPUTY" },
    employee: { id: "emp-2", role: "EMPLOYEE" },
  };

  it("forbids self-reset for all roles (must use change own password)", () => {
    expect(canResetPassword(admin, admin)).toBe(false);
    expect(canResetPassword(head, head)).toBe(false);
    expect(canResetPassword(deputy, deputy)).toBe(false);
    expect(canResetPassword(employee, employee)).toBe(false);
  });

  it("allows ADMIN to reset other accounts of any role", () => {
    expect(canResetPassword(admin, targets.admin)).toBe(true);
    expect(canResetPassword(admin, targets.head)).toBe(true);
    expect(canResetPassword(admin, targets.deputy)).toBe(true);
    expect(canResetPassword(admin, targets.employee)).toBe(true);
  });

  it("allows HEAD to reset only DEPUTY and EMPLOYEE", () => {
    expect(canResetPassword(head, targets.deputy)).toBe(true);
    expect(canResetPassword(head, targets.employee)).toBe(true);
    expect(canResetPassword(head, targets.admin)).toBe(false);
    expect(canResetPassword(head, targets.head)).toBe(false);
  });

  it("allows DEPUTY to reset only EMPLOYEE", () => {
    expect(canResetPassword(deputy, targets.employee)).toBe(true);
    expect(canResetPassword(deputy, targets.deputy)).toBe(false);
    expect(canResetPassword(deputy, targets.head)).toBe(false);
    expect(canResetPassword(deputy, targets.admin)).toBe(false);
  });

  it("forbids EMPLOYEE from resetting any password", () => {
    expect(canResetPassword(employee, targets.employee)).toBe(false);
  });
});

describe("Operational Capability Inheritance", () => {
  const admin = makeActor("ADMIN", "admin-1");
  const head = makeActor("HEAD", "head-1");

  it("ADMIN inherits all HEAD task permissions", () => {
    for (const p of [
      "task:create-self",
      "task:create-for-others",
      "task:read-self",
      "task:read-team",
      "task:update",
      "task:reassign",
      "task:cancel",
      "task:delete",
    ] as const) {
      expect(permitsTask("ADMIN", p)).toBe(true);
      expect(permitsTask("HEAD", p)).toBe(true);
    }
  });

  it("ADMIN can assign tasks to any active user", () => {
    expect(
      canAssignTask(admin, { id: "other", role: "HEAD", banned: false }),
    ).toBe(true);
    expect(
      canAssignTask(admin, { id: "other", role: "ADMIN", banned: false }),
    ).toBe(true);
    expect(
      canAssignTask(admin, { id: "other", role: "DEPUTY", banned: false }),
    ).toBe(true);
    expect(
      canAssignTask(admin, { id: "other", role: "EMPLOYEE", banned: false }),
    ).toBe(true);
    expect(
      canAssignTask(admin, { id: "other", role: "EMPLOYEE", banned: true }),
    ).toBe(false);
  });

  it("ADMIN can add and remove task assets", () => {
    const task = { assignedToId: "other", status: "OPEN", deletedAt: null };
    const asset = { createdById: "someone", deletedAt: null };
    expect(canAddAsset(admin, task)).toBe(true);
    expect(canRemoveAsset(admin, task, asset)).toBe(true);

    expect(canAddAsset(head, task)).toBe(true);
    expect(canRemoveAsset(head, task, asset)).toBe(true);
  });

  it("ADMIN can create and read brands", () => {
    expect(canCreateBrand("ADMIN")).toBe(true);
    expect(canCreateBrand("HEAD")).toBe(true);
    expect(canCreateBrand("DEPUTY")).toBe(true);
    expect(canCreateBrand("EMPLOYEE")).toBe(false);

    expect(canReadBrands("ADMIN")).toBe(true);
    expect(canReadBrands("HEAD")).toBe(true);
    expect(canReadBrands("DEPUTY")).toBe(true);
    expect(canReadBrands("EMPLOYEE")).toBe(true);
  });
});
