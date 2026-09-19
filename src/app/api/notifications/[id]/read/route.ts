import { getServerEnv } from "@/lib/env";
import { AccessError } from "@/lib/auth/permissions";
import { getNotifications } from "@/lib/notifications/server";

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const env = getServerEnv();
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(env.BETTER_AUTH_URL).origin) {
    return Response.json(
      { error: "Nguồn yêu cầu không hợp lệ." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

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
