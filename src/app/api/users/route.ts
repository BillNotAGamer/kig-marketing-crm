import { getDb } from "@/db";
import { getServerEnv } from "@/lib/env";
import { userService } from "@/lib/users/service";
import { usersHttp } from "@/lib/users/http";

async function handle(request: Request) {
  const env = getServerEnv();
  return usersHttp(request, userService(getDb(), env), env.BETTER_AUTH_URL);
}
export { handle as GET, handle as POST };
