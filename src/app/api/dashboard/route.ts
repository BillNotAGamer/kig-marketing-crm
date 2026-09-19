import { AccessError } from "@/lib/auth/permissions";
import { getDashboard } from "@/lib/dashboard/server";

export async function GET(request: Request) {
  try {
    const data = await getDashboard().getDashboardData(request.headers);
    return Response.json(data, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error: unknown) {
    if (error instanceof AccessError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json(
      { error: "Không thể tải dữ liệu bảng điều khiển." },
      { status: 503 },
    );
  }
}
