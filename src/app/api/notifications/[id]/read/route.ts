import { getServerEnv } from "@/lib/env";
import { AccessError } from "@/lib/auth/permissions";
import { getNotifications } from "@/lib/notifications/server";
import { mutationRequestError } from "@/lib/http-security";

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const env = getServerEnv();
  const invalid = mutationRequestError(request, env.BETTER_AUTH_URL);
  if (invalid) return invalid;

  try {
    const { id } = await props.params;
    const success = await getNotifications().markNotificationRead(
      request.headers,
      id,
    );
    return Response.json(
      { success },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error: unknown) {
    if (error instanceof AccessError) {
      return Response.json(
        { error: error.message },
        { status: error.status, headers: { "Cache-Control": "no-store" } },
      );
    }
    return Response.json(
      { error: "Đánh dấu đã đọc thất bại." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
