import { headers } from "next/headers";
import { requireSession } from "@/lib/auth/session";
import { getCalendar } from "@/lib/calendar/server";
import {
  currentBusinessDate,
  getMonthGrid,
  getMondayOfWeek,
  addDays,
  isValidIsoDate,
  parseIsoDate,
} from "@/lib/calendar/date";
import { CalendarShell } from "@/components/calendar/calendar-shell";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string }>;
}) {
  await requireSession();
  const params = await searchParams;

  const businessToday = currentBusinessDate();

  // Validate active date
  let activeDate = businessToday;
  if (params.date && isValidIsoDate(params.date)) {
    activeDate = params.date;
  }

  // Validate view
  const activeView: "month" | "week" =
    params.view === "week" ? "week" : "month";

  // Derive date range to query from database
  let from: string;
  let to: string;

  if (activeView === "week") {
    from = getMondayOfWeek(activeDate);
    to = addDays(from, 6);
  } else {
    const { year, month } = parseIsoDate(activeDate);
    const grid = getMonthGrid(year, month);
    from = grid[0];
    to = grid[grid.length - 1];
  }

  const { tasks } = await getCalendar().listCalendarTasks(
    new Headers(await headers()),
    { from, to },
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Lịch làm việc
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Lịch công việc toàn đội ngũ theo mốc giao và hạn hoàn thành.
          </p>
        </div>
      </div>

      <CalendarShell
        initialTasks={tasks}
        businessToday={businessToday}
        initialView={activeView}
        initialDate={activeDate}
        isTeamReader={true}
      />
    </div>
  );
}
