import { getDb } from "@/db";
import { getServerEnv } from "@/lib/env";
import { userService } from "@/lib/users/service";
import { usersHttp } from "@/lib/users/http";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const env = getServerEnv();
  return usersHttp(
    request,
    userService(getDb(), env),
    env.BETTER_AUTH_URL,
    (await context.params).id,
  );
}
