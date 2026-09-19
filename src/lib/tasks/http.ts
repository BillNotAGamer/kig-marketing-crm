import { ZodError } from "zod";
import { AccessError } from "../auth/permissions";
import type { taskService } from "./service";
import { mutationRequestError } from "../http-security";

export type TaskCommand = "metadata" | "reassign" | "cancel" | "soft-delete";
export async function tasksHttp(
  request: Request,
  service: ReturnType<typeof taskService>,
  origin: string,
  id?: string,
  command?: string,
) {
  const headers = { "Cache-Control": "no-store" };
  const response = (body: unknown, status = 200) =>
    Response.json(body, { status, headers });
  if (request.method === "POST") {
    const invalid = mutationRequestError(request, origin);
    if (invalid) return invalid;
  }
  try {
    if (request.method === "GET" && !command) {
      if (id === "assignees")
        return response(await service.listAssignees(request.headers));
      return response(
        id
          ? await service.getTask(request.headers, id)
          : await service.listTasks(request.headers),
      );
    }
    if (request.method !== "POST")
      return response({ error: "Method unavailable." }, 405);
    if (
      id &&
      !["metadata", "reassign", "cancel", "soft-delete"].includes(command ?? "")
    )
      return response({ error: "Command unavailable." }, 404);
    const input: unknown = await request.json();
    if (!id)
      return response(await service.createTask(request.headers, input), 201);
    switch (command) {
      case "metadata":
        return response(
          await service.updateTaskMetadata(request.headers, id, input),
        );
      case "reassign":
        return response(await service.reassignTask(request.headers, id, input));
      case "cancel":
        return response(await service.cancelTask(request.headers, id, input));
      case "soft-delete":
        return response(
          await service.softDeleteTask(request.headers, id, input),
        );
    }
    return response({ error: "Command unavailable." }, 404);
  } catch (error: unknown) {
    if (error instanceof AccessError)
      return response({ error: error.message }, error.status);
    if (error instanceof ZodError || error instanceof SyntaxError)
      return response(
        { error: "Invalid task input. Check fields and date ordering." },
        400,
      );
    return response({ error: "Task operation failed. Please retry." }, 503);
  }
}
