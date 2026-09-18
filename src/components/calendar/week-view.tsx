"use client";

import Link from "next/link";
import {
  getDayOfWeekMondayFirst,
  getWeekDays,
  parseIsoDate,
  VIETNAMESE_WEEKDAYS,
} from "@/lib/calendar/date";
import { deriveDateMarkers, type CalendarTaskDTO } from "@/lib/calendar/model";

interface WeekViewProps {
  selectedDate: string;
  businessToday: string;
  tasks: CalendarTaskDTO[];
  onSelectDate: (date: string) => void;
  isTeamReader: boolean;
}

export function WeekView({
  selectedDate,
  businessToday,
  tasks,
  onSelectDate,
  isTeamReader,
}: WeekViewProps) {
  const weekDays = getWeekDays(selectedDate);

  return (
    <div className="w-full space-y-2">
      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((date) => {
          const { day, month } = parseIsoDate(date);
          const dow = getDayOfWeekMondayFirst(date);
          const weekdayName = VIETNAMESE_WEEKDAYS[dow - 1];
          const isSelected = date === selectedDate;
          const isToday = date === businessToday;
          const markers = deriveDateMarkers(tasks, date, businessToday);

          return (
            <div
              key={date}
              onClick={() => onSelectDate(date)}
              className={`flex flex-col rounded-lg border p-2 text-left transition-all cursor-pointer ${
                isSelected
                  ? "border-primary bg-primary/10 ring-2 ring-primary"
                  : isToday
                    ? "border-primary/60 bg-primary/5"
                    : "border-border bg-card hover:bg-muted/40"
              }`}
            >
              {/* Column Header */}
              <div className="border-b pb-2 text-center">
                <div className="text-xs font-semibold text-muted-foreground">
                  {weekdayName}
                </div>
                <div
                  className={`mt-1 inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${
                    isToday
                      ? "bg-primary text-primary-foreground"
                      : isSelected
                        ? "text-primary"
                        : ""
                  }`}
                >
                  {day}/{month}
                </div>
              </div>

              {/* Tasks list in column */}
              <div className="mt-2 flex-1 space-y-2 overflow-y-auto">
                {markers.length === 0 ? (
                  <p className="pt-4 text-center text-xs text-muted-foreground/60">
                    Trống
                  </p>
                ) : (
                  markers.map((m) => {
                    let markerColor =
                      "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300";
                    let markerLabel = "Giao";
                    if (m.markerType === "BOTH") {
                      markerColor =
                        "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300";
                      markerLabel = "Giao & Hạn";
                    } else if (m.markerType === "DUE") {
                      markerColor =
                        "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
                      markerLabel = "Hạn";
                    }

                    return (
                      <div
                        key={`${m.task.id}-${m.markerType}`}
                        className={`rounded-md border p-2 text-xs shadow-xs ${
                          m.isOverdue
                            ? "border-red-400 dark:border-red-800"
                            : ""
                        }`}
                      >
                        <div className="flex flex-wrap items-center gap-1">
                          <span
                            className={`rounded px-1.5 py-0.2 text-[10px] font-bold ${markerColor}`}
                          >
                            {markerLabel}
                          </span>
                          <span className="rounded bg-muted px-1 text-[10px] font-medium text-muted-foreground">
                            {m.task.priority}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 font-semibold">
                          <Link
                            href={`/tasks/${m.task.id}`}
                            className="hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {m.task.title}
                          </Link>
                        </p>
                        {isTeamReader && (
                          <p className="mt-1 truncate text-[10px] text-muted-foreground">
                            {m.task.assignee.name}
                          </p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
