import { ZodError } from "zod";
import { AccessError } from "@/lib/auth/permissions";
import { ForbiddenAuditError } from "@/lib/audit/service";
import { getAudit } from "@/lib/audit/server";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const rawQuery: Record<string, unknown> = {};

    const keys = [
      "action",
      "entityType",
      "actorUserId",
      "from",
      "to",
      "page",
      "pageSize",
    ];
    for (const k of keys) {
      const v = url.searchParams.get(k);
      if (v !== null && v !== "") {
        rawQuery[k] = v;
      }
    }

    const data = await getAudit().listAuditLogs(request.headers, rawQuery);
    return Response.json(data, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error: unknown) {
    if (error instanceof ForbiddenAuditError) {
      return Response.json(
        { error: error.message },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (error instanceof AccessError) {
      return Response.json(
        { error: error.message },
        { status: error.status, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (error instanceof ZodError) {
      return Response.json(
        { error: error.issues[0]?.message || "Tham số truy vấn không hợp lệ." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    return Response.json(
      { error: "Không thể tải nhật ký hệ thống." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
