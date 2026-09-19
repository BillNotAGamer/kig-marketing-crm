import { sql } from "drizzle-orm";
import { getDb } from "@/db";

export const dynamic = "force-dynamic";
type ReadinessDb = { execute(query: ReturnType<typeof sql>): Promise<unknown> };
export async function readiness(db: ReadinessDb) {
  try {
    await db.execute(sql`SELECT 1`);
    return Response.json(
      { status: "ready" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { status: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
export function GET() {
  return readiness(getDb());
}
