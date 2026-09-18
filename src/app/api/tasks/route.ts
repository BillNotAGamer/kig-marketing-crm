import { handleTasks } from "@/lib/tasks/server";
export function GET(request: Request) {
  return handleTasks(request);
}
export function POST(request: Request) {
  return handleTasks(request);
}
