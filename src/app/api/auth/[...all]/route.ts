import { getDb } from "@/db";
import { getServerEnv } from "@/lib/env";
import { authHttp } from "@/lib/auth/http";

export const runtime = "nodejs";
async function handle(request: Request) {
  try {
    return await authHttp(request, getDb(), getServerEnv());
  } catch {
    return Response.json(
      { error: "Authentication is temporarily unavailable." },
      { status: 503 },
    );
  }
}
export { handle as GET, handle as POST };
