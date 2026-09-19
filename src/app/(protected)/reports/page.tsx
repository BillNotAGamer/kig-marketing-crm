import { headers } from "next/headers";
import { requireSession } from "@/lib/auth/session";
import { getReports } from "@/lib/reports/server";
import { ReportsView } from "@/components/reports/reports-view";

export default async function ReportsPage(props: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const actor = await requireSession();
  const searchParams = await props.searchParams;

  const data = await getReports().getReportsData(
    new Headers(await headers()),
    searchParams,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {data.isTeamView
            ? "Báo cáo tiến độ toàn nhóm"
            : "Báo cáo tiến độ cá nhân"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Thống kê hoạt động dựa trên bằng chứng báo cáo đã nộp · {actor.name} (
          {actor.role})
        </p>
      </div>

      <ReportsView data={data} />
    </div>
  );
}
