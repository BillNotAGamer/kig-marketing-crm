import Link from "next/link";
import { ArrowRight, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { CalendarMarker } from "@/lib/calendar/model";

interface TaskCalendarCardProps {
  marker: CalendarMarker;
  isTeamReader: boolean;
}

export function TaskCalendarCard({
  marker,
  isTeamReader,
}: TaskCalendarCardProps) {
  const { task, markerType, isOverdue } = marker;

  let markerLabel = "Giao";
  let markerBadgeClass =
    "bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border-blue-200 dark:border-blue-900";

  if (markerType === "BOTH") {
    markerLabel = "Giao & Hạn";
    markerBadgeClass =
      "bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border-purple-200 dark:border-purple-900";
  } else if (markerType === "DUE") {
    markerLabel = "Đến hạn";
    markerBadgeClass =
      "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-200 dark:border-amber-900";
  }

  return (
    <Card
      className={`transition-shadow hover:shadow-md ${
        isOverdue ? "border-red-300 dark:border-red-900/60" : ""
      }`}
    >
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`rounded border px-2 py-0.5 text-xs font-semibold ${markerBadgeClass}`}
            >
              {markerLabel}
            </span>
            {isOverdue && (
              <span className="inline-flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800 dark:bg-red-950/80 dark:text-red-300">
                <AlertTriangle className="h-3 w-3" />
                Quá hạn
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
        </div>

        <h3 className="line-clamp-2 text-base font-semibold leading-snug">
          <Link
            href={`/tasks/${task.id}`}
            className="hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            {task.title}
          </Link>
        </h3>

        {isTeamReader && (
          <p className="mt-2 text-xs text-muted-foreground">
            Người phụ trách:{" "}
            <span className="font-medium text-foreground">
              {task.assignee.name}
            </span>
          </p>
        )}

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>Giao: {task.assignedDate}</span>
          {task.dueDate && <span>Hạn: {task.dueDate}</span>}
        </div>

        {task.todayProgressStatus && (
          <div className="mt-2 flex items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">Tiến độ hôm nay:</span>
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

        <div className="mt-3 pt-2">
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
}
