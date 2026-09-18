import { toNextJsHandler } from "better-auth/next-js";
import { sql } from "drizzle-orm";
import type { ServerEnv } from "../env-schema";
import { createAuth, type AuthDatabase } from "./factory";
import { loginSchema } from "./validation";

// All account/admin/generic self-update endpoints are closed at the HTTP boundary.
export async function authHttp(
  request: Request,
  db: AuthDatabase,
  env: ServerEnv,
) {
  const path = new URL(request.url).pathname;
  const allowed =
    (request.method === "POST" &&
      ["/api/auth/sign-in/email", "/api/auth/sign-out"].includes(path)) ||
    (request.method === "GET" && path === "/api/auth/get-session");
  if (!allowed)
    return Response.json({ error: "Endpoint unavailable." }, { status: 403 });
  if (
    request.method === "POST" &&
    request.headers.get("origin") !== new URL(env.BETTER_AUTH_URL).origin
  )
    return Response.json({ error: "Invalid origin." }, { status: 403 });
  if (path === "/api/auth/sign-in/email") {
    const parsed = loginSchema.safeParse(
      await request
        .clone()
        .json()
        .catch(() => null),
    );
    if (!parsed.success)
      return Response.json({ error: "Invalid login fields." }, { status: 400 });
    try {
      return await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(24091802)`);
        const auth = createAuth(tx, env);
        // NextRequest and Node's Request can come from different runtime realms.
        const normalized = new Request(request.url, {
          method: request.method,
          headers: request.headers,
          body: JSON.stringify(parsed.data),
        });
        const response = await toNextJsHandler(auth).POST(normalized);
        if (!response.ok) throw response;
        return response;
      });
    } catch (error: unknown) {
      if (error instanceof Response) return error;
      throw error;
    }
  }
  const handler = toNextJsHandler(createAuth(db, env));
  return request.method === "GET"
    ? handler.GET(request)
    : handler.POST(request);
}
