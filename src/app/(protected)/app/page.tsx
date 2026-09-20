import Link from "next/link";
import { headers } from "next/headers";
import { requireSession } from "@/lib/auth/session";
import { getCalendar } from "@/lib/calendar/server";
import { formatVietnameseDate } from "@/lib/calendar/date";
import { roleDisplay } from "@/lib/ui-labels";
import { TodayView } from "@/components/calendar/today-view";
import { Button } from "@/components/ui/button";
import { Calendar, Plus } from "lucide-react";

export default async function ApplicationHome() {
  const actor = await requireSession();
  const { categorized, businessToday } = await getCalendar().getTodayOverview(
    new Headers(await headers()),
  );
  const isTeamReader = actor.role !== "EMPLOYEE";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Hôm nay
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatVietnameseDate(businessToday)} · Xin chào, {actor.name} ·{" "}
            {roleDisplay[actor.role] ?? actor.role}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" className="min-h-11">
            <Link href="/calendar">
              <Calendar className="mr-2 h-4 w-4" />
              Xem lịch
            </Link>
          </Button>
          <Button asChild className="min-h-11">
            <Link href="/tasks/new">
              <Plus className="mr-2 h-4 w-4" />
              Tạo công việc
            </Link>
          </Button>
        </div>
      </div>

      <TodayView tasks={categorized} isTeamReader={isTeamReader} />
    </div>
  );
}
