import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
} from "better-auth/api";
import { eq } from "drizzle-orm";
import type { Database } from "../../db/connection";
import * as schema from "../../db/schema";
import type { ServerEnv } from "../env-schema";
import { authOptions } from "./options";

export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type AuthDatabase = Database | Transaction;
export function createAuth(db: AuthDatabase, env: ServerEnv) {
  return betterAuth({
    ...authOptions,
    emailAndPassword: {
      ...authOptions.emailAndPassword,
      minPasswordLength: 6,
      maxPasswordLength: 128,
    },
    database: drizzleAdapter(db, { provider: "pg", schema, transaction: true }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    logger: { disabled: true },
    session: { cookieCache: { enabled: false } },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path === "/change-password") {
          const current = await getSessionFromCtx(ctx, {
            disableCookieCache: true,
          });
          if (!current) throw new APIError("UNAUTHORIZED");
          const [actor] = await db
            .select()
            .from(schema.user)
            .where(eq(schema.user.id, current.user.id));
          if (!actor || actor.banned || actor.role !== "HEAD")
            throw new APIError("FORBIDDEN", {
              message: "HEAD authorization required.",
            });
        }
      }),
    },
    databaseHooks: {
      ...authOptions.databaseHooks,
      session: {
        create: {
          after: async (created, context) => {
            if (context?.path === "/sign-in/email") {
              await db.insert(schema.auditLog).values({
                actorUserId: created.userId,
                action: "LOGIN",
                entityType: "user",
                entityId: created.userId,
              });
            }
          },
        },
      },
    },
  });
}
