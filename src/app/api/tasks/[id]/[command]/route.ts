import { handleTasks } from "@/lib/tasks/server";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; command: string }> },
) {
  const { id, command } = await context.params;
  return handleTasks(request, id, command);
}
