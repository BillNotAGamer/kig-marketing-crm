import { handleProgress } from "@/lib/progress/server";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; progressId: string }> },
) {
  const { id, progressId } = await context.params;
  return handleProgress(request, id, progressId);
}
