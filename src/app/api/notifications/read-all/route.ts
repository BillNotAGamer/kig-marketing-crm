import { getServerEnv } from "@/lib/env";
import { AccessError } from "@/lib/auth/permissions";
import { getNotifications } from "@/lib/notifications/server";

export async function POST(request: Request) {
  const env = getServerEnv();
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(env.BETTER_AUTH_URL).origin) {
    return Response.json(
      { error: "Nguồn yêu cầu không hợp lệ." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const count = await getNotifications().markAllNotificationsRead(
      request.headers,
    );
    return Response.json(
      { success: true, count },
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
      { error: "Đánh dấu tất cả đã đọc thất bại." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
