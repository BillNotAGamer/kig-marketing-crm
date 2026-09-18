import type { BetterAuthOptions, BetterAuthPlugin } from "better-auth";
import { APIError } from "better-auth/api";
import { admin } from "better-auth/plugins";
import { z } from "zod";
import { adminAccessControl, appRoleValues, authRoles } from "./roles";

const roleSchema = z.enum(appRoleValues);
const restrictiveUserReference = {
  type: "string",
  required: true,
  index: true,
  references: { model: "user", field: "id", onDelete: "restrict" },
} as const;

// Overrides metadata on upstream models; does not recreate Better Auth tables.
const persistenceInvariants = {
  id: "kig-persistence-invariants",
  schema: {
    user: {
      fields: {
        role: {
          type: [...appRoleValues],
          required: true,
          input: false,
          defaultValue: "EMPLOYEE",
        },
        banned: {
          type: "boolean",
          required: true,
          input: false,
          defaultValue: false,
        },
      },
    },
    session: { fields: { userId: restrictiveUserReference } },
    account: { fields: { userId: restrictiveUserReference } },
  },
} satisfies BetterAuthPlugin;

function assertSingleRole(value: unknown) {
  if (!roleSchema.safeParse(value).success) {
    throw new APIError("BAD_REQUEST", {
      message: "Exactly one valid KIG role is required.",
    });
  }
}

// Shared unchanged by the runtime instance and the offline CLI instance.
export const authOptions = {
  appName: "KIG Marketing CRM",
  telemetry: { enabled: false },
  emailAndPassword: { enabled: true, disableSignUp: true },
  user: { deleteUser: { enabled: false } },
  advanced: { database: { generateId: "uuid" } },
  plugins: [
    admin({
      ac: adminAccessControl,
      roles: authRoles,
      defaultRole: "EMPLOYEE",
      adminRoles: ["HEAD"],
    }),
    persistenceInvariants,
  ],
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          assertSingleRole(user.role ?? "EMPLOYEE");
        },
      },
      update: {
        before: async (user) => {
          if (user.role !== undefined) assertSingleRole(user.role);
        },
      },
    },
  },
} satisfies BetterAuthOptions;
