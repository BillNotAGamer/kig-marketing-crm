import { ZodError } from "zod";
import { AccessError } from "@/lib/auth/permissions";
import { getNotifications } from "@/lib/notifications/server";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const rawParams: Record<string, unknown> = {};
    const page = url.searchParams.get("page");
    const pageSize = url.searchParams.get("pageSize");
    if (page) rawParams.page = page;
    if (pageSize) rawParams.pageSize = pageSize;

    const data = await getNotifications().listNotifications(
      request.headers,
      rawParams,
    );
    return Response.json(data, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error: unknown) {
    if (error instanceof AccessError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof ZodError) {
      return Response.json(
        {
          error: error.issues[0]?.message || "Tham số phân trang không hợp lệ.",
        },
        { status: 400 },
      );
    }
    return Response.json(
      { error: "Không thể tải danh sách thông báo." },
      { status: 503 },
    );
  }
}
