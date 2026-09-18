import { handleTasks } from "@/lib/tasks/server";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleTasks(request, (await context.params).id);
}
