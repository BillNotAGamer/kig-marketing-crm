import Link from "next/link";
import { AlertTriangle, CalendarCheck2, Clock, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { TodayCategorizedTask } from "@/lib/calendar/model";

interface TodayViewProps {
  tasks: TodayCategorizedTask[];
  isTeamReader: boolean;
}

export function TodayView({ tasks, isTeamReader }: TodayViewProps) {
  if (tasks.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center text-muted-foreground sm:p-10">
        <CalendarCheck2 className="mx-auto h-10 w-10 text-muted-foreground/60" />
        <p className="mt-3 text-base font-medium text-foreground">
          Không có công việc nào cần xử lý hôm nay
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {isTeamReader
            ? "Đội ngũ không có công việc đến hạn hoặc quá hạn vào hôm nay."
            : "Bạn không có công việc quá hạn hoặc cần làm hôm nay."}
        </p>
        <div className="mt-5">
          <Button asChild variant="outline" className="min-h-11">
            <Link href="/tasks">Xem tất cả công việc</Link>
          </Button>
        </div>
      </div>
    );
  }

  const overdueCount = tasks.filter((t) => t.isOverdue).length;
  const dueTodayCount = tasks.filter((t) => t.isDueToday).length;
  const assignedTodayCount = tasks.filter((t) => t.isAssignedToday).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {overdueCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 font-medium text-red-800 dark:bg-red-950/60 dark:text-red-300">
            <AlertTriangle className="h-3.5 w-3.5" />
            {overdueCount} quá hạn
          </span>
        )}
        {dueTodayCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 font-medium text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
            <Clock className="h-3.5 w-3.5" />
            {dueTodayCount} đến hạn hôm nay
          </span>
        )}
        {assignedTodayCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 font-medium text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
            <CalendarCheck2 className="h-3.5 w-3.5" />
            {assignedTodayCount} giao hôm nay
          </span>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tasks.map(({ task, isOverdue, isDueToday, isAssignedToday }) => {
          let markerLabel = "";
          let markerColorClass = "";

          if (isOverdue) {
            markerLabel = "Quá hạn";
            markerColorClass =
              "bg-red-100 text-red-800 dark:bg-red-950/80 dark:text-red-300 border-red-200 dark:border-red-900";
          } else if (isAssignedToday && isDueToday) {
            markerLabel = "Giao & Hạn hôm nay";
            markerColorClass =
              "bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border-purple-200 dark:border-purple-900";
          } else if (isDueToday) {
            markerLabel = "Đến hạn hôm nay";
            markerColorClass =
              "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-200 dark:border-amber-900";
          } else if (isAssignedToday) {
            markerLabel = "Giao hôm nay";
            markerColorClass =
              "bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border-blue-200 dark:border-blue-900";
          }

          return (
            <Card
              key={task.id}
              className={`flex flex-col justify-between transition-shadow hover:shadow-md ${
                isOverdue ? "border-red-300 dark:border-red-900/60" : ""
              }`}
            >
              <CardHeader className="space-y-2 pb-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  {markerLabel && (
                    <span
                      className={`inline-block rounded border px-2 py-0.5 text-xs font-semibold ${markerColorClass}`}
                    >
                      {markerLabel}
                    </span>
                  )}
                  <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {task.priority}
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      task.status === "COMPLETED"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : task.status === "CANCELLED"
                          ? "bg-zinc-100 text-zinc-600 line-through dark:bg-zinc-800 dark:text-zinc-400"
                          : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                    }`}
                  >
                    {task.status}
                  </span>
                </div>
                <CardTitle className="line-clamp-2 text-base font-semibold">
                  <Link
                    href={`/tasks/${task.id}`}
                    className="hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                  >
                    {task.title}
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-0 text-sm">
                {isTeamReader && (
                  <p className="text-muted-foreground">
                    Người phụ trách:{" "}
                    <span className="font-medium text-foreground">
                      {task.assignee.name}
                    </span>
                  </p>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>Giao: {task.assignedDate}</span>
                  {task.dueDate && <span>Hạn: {task.dueDate}</span>}
                </div>

                {task.todayProgressStatus && (
                  <div className="flex items-center gap-2 pt-1 text-xs">
                    <span className="text-muted-foreground">
                      Tiến độ hôm nay:
                    </span>
                    <span
                      className={`rounded px-2 py-0.5 font-medium ${
                        task.todayProgressStatus === "COMPLETED"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : task.todayProgressStatus === "NOT_COMPLETED"
                            ? "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {task.todayProgressStatus === "COMPLETED"
                        ? "Đã hoàn thành"
                        : task.todayProgressStatus === "NOT_COMPLETED"
                          ? "Chưa hoàn thành"
                          : "Chưa báo cáo"}
                    </span>
                  </div>
                )}

                <div className="pt-2">
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="w-full min-h-[44px] justify-between"
                  >
                    <Link href={`/tasks/${task.id}`}>
                      <span>Xem chi tiết</span>
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
