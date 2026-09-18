import { appRoleValues, type AppRole } from "./roles";

export const userPermissions = [
  "user:create",
  "user:read",
  "user:update",
  "user:disable",
  "user:enable",
  "user:change-role",
  "user:reset-password",
] as const;
export type Permission = (typeof userPermissions)[number];
const grants: Record<AppRole, readonly Permission[]> = {
  HEAD: userPermissions,
  DEPUTY: [],
  EMPLOYEE: [],
};
export function hasPermission(role: string, permission: Permission): boolean {
  return (
    appRoleValues.some((value) => value === role) &&
    grants[role as AppRole].includes(permission)
  );
}
export class AccessError extends Error {
  constructor(
    public readonly status: 400 | 401 | 403 | 404 | 409,
    message: string,
  ) {
    super(message);
  }
}
