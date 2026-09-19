import { ZodError } from "zod";
import { AccessError } from "@/lib/auth/permissions";
import { getReports } from "@/lib/reports/server";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const rawQuery: Record<string, unknown> = {};
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    if (from) rawQuery.from = from;
    if (to) rawQuery.to = to;

    const data = await getReports().getReportsData(request.headers, rawQuery);
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
        { error: error.issues[0]?.message || "Tham số báo cáo không hợp lệ." },
        { status: 400 },
      );
    }
    return Response.json(
      { error: "Không thể tải dữ liệu báo cáo." },
      { status: 503 },
    );
  }
}
