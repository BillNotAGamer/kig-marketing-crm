import { ZodError } from "zod";
import { AccessError } from "../auth/permissions";
import type { CalendarService } from "./service";

export async function calendarHttp(request: Request, service: CalendarService) {
  const response = (body: unknown, status = 200) =>
    Response.json(body, {
      status,
      headers: { "Cache-Control": "no-store" },
    });

  if (request.method !== "GET") {
    return response({ error: "Method unavailable." }, 405);
  }

  try {
    const url = new URL(request.url);
    const from = url.searchParams.get("from") ?? undefined;
    const to = url.searchParams.get("to") ?? undefined;
    const view = url.searchParams.get("view") ?? undefined;
    const date = url.searchParams.get("date") ?? undefined;

    const rawInput: Record<string, unknown> = {};
    if (from !== undefined) rawInput.from = from;
    if (to !== undefined) rawInput.to = to;
    if (view !== undefined) rawInput.view = view;
    if (date !== undefined) rawInput.date = date;

    // Reject unknown parameters
    for (const key of url.searchParams.keys()) {
      if (!["from", "to", "view", "date"].includes(key)) {
        rawInput[key] = url.searchParams.get(key);
      }
    }

    const result = await service.listCalendarTasks(request.headers, rawInput);
    return response(result);
  } catch (error: unknown) {
    if (error instanceof AccessError) {
      return response({ error: error.message }, error.status);
    }
    if (error instanceof ZodError) {
      return response(
        {
          error:
            error.issues[0]?.message ??
            "Invalid calendar query parameters. Use ISO format YYYY-MM-DD.",
        },
        400,
      );
    }
    return response({ error: "Calendar query failed. Please retry." }, 503);
  }
}
