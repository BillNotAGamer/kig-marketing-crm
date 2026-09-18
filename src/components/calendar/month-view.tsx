"use client";

import {
  getMonthGrid,
  parseIsoDate,
  VIETNAMESE_WEEKDAYS,
} from "@/lib/calendar/date";
import { deriveDateMarkers, type CalendarTaskDTO } from "@/lib/calendar/model";

interface MonthViewProps {
  year: number;
  month: number;
  selectedDate: string;
  businessToday: string;
  tasks: CalendarTaskDTO[];
  onSelectDate: (date: string) => void;
  isTeamReader: boolean;
}

export function MonthView({
  year,
  month,
  selectedDate,
  businessToday,
  tasks,
  onSelectDate,
  isTeamReader,
}: MonthViewProps) {
  const gridDates = getMonthGrid(year, month);

  return (
    <div className="w-full space-y-2">
      {/* Weekday headers: Monday to Sunday */}
      <div className="grid grid-cols-7 gap-1 text-center sm:gap-2">
        {VIETNAMESE_WEEKDAYS.map((name) => (
          <div
            key={name}
            className="py-2 text-xs font-semibold text-muted-foreground"
          >
            {name}
          </div>
        ))}
      </div>

      {/* Month grid */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {gridDates.map((date) => {
          const { month: dMonth, day } = parseIsoDate(date);
          const isCurrentMonth = dMonth === month;
          const isSelected = date === selectedDate;
          const isToday = date === businessToday;
          const markers = deriveDateMarkers(tasks, date, businessToday);
          const maxVisible = 2;
          const visibleMarkers = markers.slice(0, maxVisible);
          const overflowCount = markers.length - maxVisible;

          return (
            <div
              key={date}
              tabIndex={0}
              role="button"
              aria-label={`Ngày ${day} tháng ${dMonth}${isToday ? " (Hôm nay)" : ""}${isSelected ? " (Đang chọn)" : ""}, ${markers.length} công việc`}
              aria-pressed={isSelected}
              onClick={() => onSelectDate(date)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectDate(date);
                }
              }}
              className={`flex min-h-[90px] flex-col justify-between rounded-lg border p-1.5 text-left transition-all sm:min-h-[110px] sm:p-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary ${
                isSelected
                  ? "border-primary bg-primary/10 ring-2 ring-primary shadow-sm"
                  : isToday
                    ? "border-primary/60 bg-primary/5 hover:bg-muted"
                    : isCurrentMonth
                      ? "border-border bg-card hover:bg-muted/50"
                      : "border-border/40 bg-muted/20 text-muted-foreground/60 hover:bg-muted/30"
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                    isToday
                      ? "bg-primary text-primary-foreground"
                      : isSelected
                        ? "font-extrabold text-primary"
                        : ""
                  }`}
                >
                  {day}
                </span>
                {markers.length > 0 && (
                  <span className="text-[10px] font-medium text-muted-foreground sm:hidden">
                    {markers.length}
                  </span>
                )}
              </div>

              {/* Visible task markers inside date cell */}
              <div className="mt-1 flex-1 space-y-1 overflow-hidden">
                {visibleMarkers.map((m) => {
                  let markerColor =
                    "bg-blue-500/20 text-blue-700 dark:text-blue-300";
                  let markerAbbr = "G";
                  if (m.markerType === "BOTH") {
                    markerColor =
                      "bg-purple-500/20 text-purple-700 dark:text-purple-300";
                    markerAbbr = "G&H";
                  } else if (m.markerType === "DUE") {
                    markerColor =
                      "bg-amber-500/20 text-amber-700 dark:text-amber-300";
                    markerAbbr = "H";
                  }

                  return (
                    <div
                      key={`${m.task.id}-${m.markerType}`}
                      title={`${m.markerType}: ${m.task.title}${isTeamReader ? ` (${m.task.assignee.name})` : ""}`}
                      className={`hidden truncate rounded px-1.5 py-0.5 text-[11px] leading-tight font-medium sm:block ${markerColor} ${
                        m.task.status === "COMPLETED"
                          ? "line-through opacity-75"
                          : m.task.status === "CANCELLED"
                            ? "line-through opacity-50"
                            : ""
                      }`}
                    >
                      <span className="mr-1 font-bold">{markerAbbr}:</span>
                      {m.task.title}
                    </div>
                  );
                })}

                {overflowCount > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectDate(date);
                    }}
                    className="hidden rounded px-1 text-[10px] font-medium text-primary hover:underline sm:inline-block"
                  >
                    +{overflowCount} công việc
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
