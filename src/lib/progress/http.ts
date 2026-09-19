import { ZodError } from "zod";
import { AccessError } from "../auth/permissions";
import type { progressService } from "./service";
import { mutationRequestError } from "../http-security";

export async function progressHttp(
  request: Request,
  service: ReturnType<typeof progressService>,
  origin: string,
  id: string,
  progressId?: string,
) {
  const response = (body: unknown, status = 200) =>
    Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  if (request.method === "POST") {
    const invalid = mutationRequestError(request, origin);
    if (invalid) return invalid;
  }
  try {
    if (request.method === "GET" && !progressId)
      return response(await service.getTaskProgress(request.headers, id));
    if (request.method !== "POST")
      return response({ error: "Method unavailable." }, 405);
    const input: unknown = await request.json();
    return response(
      progressId
        ? await service.correctTaskProgress(
            request.headers,
            id,
            progressId,
            input,
          )
        : await service.submitTaskProgress(request.headers, id, input),
      progressId ? 200 : 201,
    );
  } catch (error: unknown) {
    if (error instanceof AccessError)
      return response({ error: error.message }, error.status);
    if (error instanceof ZodError || error instanceof SyntaxError)
      return response(
        { error: "Invalid progress input. Check status and required reasons." },
        400,
      );
    return response({ error: "Progress operation failed. Please retry." }, 503);
  }
}
