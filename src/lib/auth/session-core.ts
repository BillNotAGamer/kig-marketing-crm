import { eq } from "drizzle-orm";
import { user } from "../../db/schema";
import type { AuthDatabase, createAuth } from "./factory";
import { AccessError, hasPermission, type Permission } from "./permissions";
import { appRoleValues, type AppRole } from "./roles";

export type Actor = { id: string; name: string; email: string; role: AppRole };
export async function currentActor(
  db: AuthDatabase,
  auth: ReturnType<typeof createAuth>,
  headers: Headers,
): Promise<Actor | null> {
  const current = await auth.api.getSession({
    headers,
    query: { disableCookieCache: true, disableRefresh: true },
  });
  if (!current) return null;
  const [canonical] = await db
    .select()
    .from(user)
    .where(eq(user.id, current.user.id));
  if (
    !canonical ||
    canonical.banned ||
    !appRoleValues.some((role) => role === canonical.role)
  )
    return null;
  return {
    id: canonical.id,
    name: canonical.name,
    email: canonical.email,
    role: canonical.role as AppRole,
  };
}
export async function authorizedActor(
  db: AuthDatabase,
  auth: ReturnType<typeof createAuth>,
  headers: Headers,
  permission?: Permission,
) {
  const actor = await currentActor(db, auth, headers);
  if (!actor) throw new AccessError(401, "Authentication required.");
  if (permission && !hasPermission(actor.role, permission))
    throw new AccessError(403, "Access denied.");
  return actor;
}
