import { and, eq } from "drizzle-orm";
import { user, auditLog } from "../../db/schema";
import type { ServerEnv } from "../env-schema";
import { createAuth, type AuthDatabase } from "../auth/factory";
import { nameSchema, emailSchema, passwordSchema } from "../auth/validation";
import { administrationLock } from "./locks";
import { z } from "zod";

export const bootstrapSchema = z
  .object({ name: nameSchema, email: emailSchema, password: passwordSchema })
  .strict();
export async function bootstrapHead(
  db: AuthDatabase,
  env: ServerEnv,
  input: unknown,
) {
  const values = bootstrapSchema.parse(input);
  return db.transaction(async (tx) => {
    await tx.execute(administrationLock);
    const heads = await tx
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.role, "HEAD"), eq(user.banned, false)));
    if (heads.length)
      throw new Error("Bootstrap refused: an ACTIVE HEAD already exists.");
    const result = await createAuth(tx, env).api.createUser({
      body: { ...values, role: "HEAD" },
    });
    await tx.insert(auditLog).values({
      actorUserId: result.user.id,
      action: "CREATE_USER",
      entityType: "user",
      entityId: result.user.id,
      metadata: { bootstrap: true },
    });
    return result.user.id;
  });
}
