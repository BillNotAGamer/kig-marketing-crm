import { handleCalendar } from "@/lib/calendar/server";

export async function GET(request: Request) {
  return handleCalendar(request);
}
