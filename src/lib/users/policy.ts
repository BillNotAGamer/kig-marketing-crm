import type { Actor } from "../auth/session-core";
import type { AppRole } from "../auth/roles";
import { DELETED_USER_SENTINEL_ID } from "./sentinel";

/**
 * Checks whether an actor role is permitted to create a user with the target role.
 */
export function canCreateRole(
  actorRole: AppRole,
  targetRole: AppRole,
): boolean {
  switch (actorRole) {
    case "ADMIN":
      return (
        targetRole === "ADMIN" ||
        targetRole === "HEAD" ||
        targetRole === "DEPUTY" ||
        targetRole === "EMPLOYEE"
      );
    case "HEAD":
      return targetRole === "DEPUTY" || targetRole === "EMPLOYEE";
    case "DEPUTY":
      return targetRole === "EMPLOYEE";
    case "EMPLOYEE":
    default:
      return false;
  }
}

/**
 * Returns the list of roles that an actor role is permitted to assign upon user creation.
 */
export function allowedCreationRoles(actorRole: AppRole): AppRole[] {
  switch (actorRole) {
    case "ADMIN":
      return ["ADMIN", "HEAD", "DEPUTY", "EMPLOYEE"];
    case "HEAD":
      return ["DEPUTY", "EMPLOYEE"];
    case "DEPUTY":
      return ["EMPLOYEE"];
    case "EMPLOYEE":
    default:
      return [];
  }
}

/**
 * Checks whether an actor can view a target user in User Management.
 * - System sentinel is strictly hidden from User Management for all roles.
 * - ADMIN: sees all real users
 * - HEAD: sees self, DEPUTY, and EMPLOYEE (hides ADMIN and peer HEADs)
 * - DEPUTY: sees EMPLOYEE users only
 * - EMPLOYEE: sees no users (cannot access user management)
 */
export function canViewManagedUser(
  actor: Actor,
  target: { id: string; role: string },
): boolean {
  if (target.id === DELETED_USER_SENTINEL_ID) {
    return false;
  }
  switch (actor.role) {
    case "ADMIN":
      return true;
    case "HEAD":
      return (
        target.id === actor.id ||
        target.role === "DEPUTY" ||
        target.role === "EMPLOYEE"
      );
    case "DEPUTY":
      return target.role === "EMPLOYEE";
    case "EMPLOYEE":
    default:
      return false;
  }
}

/**
 * Checks whether an actor has authority to manage a specific target user.
 * - Sentinel user cannot be managed by any actor.
 * - ADMIN: can manage all real users (including self)
 * - HEAD: can manage DEPUTY, EMPLOYEE, and self (for own profile update)
 * - DEPUTY: can manage EMPLOYEE only
 * - EMPLOYEE: cannot manage any user
 */
export function canManageTarget(
  actor: Actor,
  target: { id: string; role: string },
): boolean {
  if (target.id === DELETED_USER_SENTINEL_ID) {
    return false;
  }
  if (actor.id === target.id) {
    return actor.role === "ADMIN" || actor.role === "HEAD";
  }
  switch (actor.role) {
    case "ADMIN":
      return true;
    case "HEAD":
      return target.role === "DEPUTY" || target.role === "EMPLOYEE";
    case "DEPUTY":
      return target.role === "EMPLOYEE";
    case "EMPLOYEE":
    default:
      return false;
  }
}

/**
 * Checks whether an actor is authorized to permanently delete a target user.
 * - Only ADMIN may delete users.
 * - HEAD, DEPUTY, EMPLOYEE cannot delete any user.
 * - Sentinel account cannot be deleted.
 * - Additional transactional invariant checks (final active ADMIN, open tasks)
 *   are enforced inside the deletion transaction under advisory lock.
 */
export function canPermanentlyDeleteUser(
  actor: Actor,
  target: { id: string; role: string },
): boolean {
  if (actor.role !== "ADMIN") {
    return false;
  }
  if (target.id === DELETED_USER_SENTINEL_ID) {
    return false;
  }
  return ["ADMIN", "HEAD", "DEPUTY", "EMPLOYEE"].includes(target.role);
}

/**
 * Checks whether an actor can edit the name and email of a target user.
 */
export function canEditIdentity(
  actor: Actor,
  target: { id: string; role: string },
): boolean {
  return canManageTarget(actor, target);
}

/**
 * Checks whether an actor can assign a new role to a target user.
 * - Self-role changes are strictly prohibited for non-ADMIN, and ADMIN self-demotion
 *   is handled with final-active-ADMIN verification.
 * - ADMIN can assign ADMIN, HEAD, DEPUTY, EMPLOYEE to any manageable user.
 * - HEAD can move subordinates between DEPUTY and EMPLOYEE only.
 * - DEPUTY cannot change any user's role.
 * - EMPLOYEE cannot change any user's role.
 */
export function canAssignRole(
  actor: Actor,
  target: { id: string; role: string },
  newRole: AppRole,
): boolean {
  if (actor.id === target.id) {
    // Only ADMIN may change own role, provided they don't break the invariant (checked in service)
    if (actor.role !== "ADMIN") return false;
    return true;
  }
  if (!canManageTarget(actor, target)) return false;

  switch (actor.role) {
    case "ADMIN":
      return true;
    case "HEAD":
      return (
        (target.role === "DEPUTY" || target.role === "EMPLOYEE") &&
        (newRole === "DEPUTY" || newRole === "EMPLOYEE")
      );
    case "DEPUTY":
    case "EMPLOYEE":
    default:
      return false;
  }
}

/**
 * Checks whether an actor can disable (deactivate) a target user.
 */
export function canDisableUser(
  actor: Actor,
  target: { id: string; role: string },
): boolean {
  return canManageTarget(actor, target);
}

/**
 * Checks whether an actor can enable (activate) a target user.
 */
export function canEnableUser(
  actor: Actor,
  target: { id: string; role: string },
): boolean {
  // An actor cannot self-enable since disabled users have no active session
  if (actor.id === target.id) return false;
  return canManageTarget(actor, target);
}

/**
 * Checks whether an actor can reset the password of a target user.
 * Self password resets must use the dedicated changeOwnPassword flow.
 */
export function canResetPassword(
  actor: Actor,
  target: { id: string; role: string },
): boolean {
  if (actor.id === target.id) return false;
  return canManageTarget(actor, target);
}
