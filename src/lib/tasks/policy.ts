import type { Actor } from "../auth/session-core";
import { AccessError } from "../auth/permissions";
import type { AppRole } from "../auth/roles";

export const taskPermissions = [
  "task:create-self",
  "task:create-for-others",
  "task:read-self",
  "task:read-team",
  "task:update",
  "task:reassign",
  "task:cancel",
  "task:delete",
] as const;
export type TaskPermission = (typeof taskPermissions)[number];
const grants: Record<AppRole, readonly TaskPermission[]> = {
  ADMIN: taskPermissions,
  HEAD: taskPermissions,
  DEPUTY: [
    "task:create-self",
    "task:create-for-others",
    "task:read-self",
    "task:read-team",
  ],
  EMPLOYEE: ["task:create-self", "task:read-self"],
};
export function permitsTask(role: AppRole, permission: TaskPermission) {
  return grants[role].includes(permission);
}
export function requireTaskPermission(
  actor: Actor,
  permission: TaskPermission,
) {
  if (!permitsTask(actor.role, permission))
    throw new AccessError(403, "Access denied.");
}
export function canAssignTask(
  actor: Actor,
  target: { id: string; role: string; banned: boolean },
) {
  if (target.banned) return false;
  if (target.id === actor.id)
    return permitsTask(actor.role, "task:create-self");
  return (
    permitsTask(actor.role, "task:create-for-others") &&
    (actor.role === "ADMIN" ||
      actor.role === "HEAD" ||
      target.role === "EMPLOYEE")
  );
}
export function canReadTask(
  actor: Actor,
  target: { assignedToId: string; deletedAt: Date | null },
) {
  return (
    target.deletedAt === null &&
    (permitsTask(actor.role, "task:read-team") ||
      target.assignedToId === actor.id)
  );
}
