import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/admin/access";

export const appRoleValues = ["HEAD", "DEPUTY", "EMPLOYEE"] as const;
export type AppRole = (typeof appRoleValues)[number];

// Describe the complete upstream vocabulary, then grant only approved actions.
export const adminAccessControl = createAccessControl(defaultStatements);
export const headUserActions = [
  "create",
  "list",
  "get",
  "update",
  "set-role",
  "ban",
  "set-password",
  "set-email",
] as const;
export const authRoles = {
  HEAD: adminAccessControl.newRole({ user: [...headUserActions], session: [] }),
  DEPUTY: adminAccessControl.newRole({ user: [], session: [] }),
  EMPLOYEE: adminAccessControl.newRole({ user: [], session: [] }),
};
