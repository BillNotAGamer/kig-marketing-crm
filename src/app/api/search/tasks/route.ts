import { ZodError } from "zod";
import { AccessError } from "@/lib/auth/permissions";
import { getSearch } from "@/lib/search/server";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const rawParams: Record<string, unknown> = {};

    const keys = [
      "q",
      "status",
      "priority",
      "assigneeId",
      "fromAssigned",
      "toAssigned",
      "fromDue",
      "toDue",
      "page",
      "pageSize",
    ];
    for (const key of keys) {
      const val = url.searchParams.get(key);
      if (val !== null && val !== "") {
        rawParams[key] = val;
      }
    }

    const data = await getSearch().searchTasks(request.headers, rawParams);
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
          error: error.issues[0]?.message || "Tham số tìm kiếm không hợp lệ.",
        },
        { status: 400 },
      );
    }
    return Response.json(
      { error: "Tìm kiếm công việc thất bại. Vui lòng thử lại." },
      { status: 503 },
    );
  }
}
