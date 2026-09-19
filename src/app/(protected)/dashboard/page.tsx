import { headers } from "next/headers";
import { requireSession } from "@/lib/auth/session";
import { getDashboard } from "@/lib/dashboard/server";
import { formatVietnameseDate } from "@/lib/calendar/date";
import { DashboardView } from "@/components/dashboard/dashboard-view";

export default async function DashboardPage() {
  const actor = await requireSession();
  const data = await getDashboard().getDashboardData(
    new Headers(await headers()),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {data.isTeamView ? "Tổng quan hoạt động nhóm" : "Tổng quan cá nhân"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatVietnameseDate(data.businessToday)} · {actor.name} (
          {actor.role})
        </p>
      </div>

      <DashboardView data={data} />
    </div>
  );
}
