"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  addDays,
  formatVietnameseDate,
  getDayOfWeekMondayFirst,
  getWeekDays,
  parseIsoDate,
  VIETNAMESE_WEEKDAYS_SHORT,
} from "@/lib/calendar/date";
import { deriveDateMarkers, type CalendarTaskDTO } from "@/lib/calendar/model";

interface MobileDateStripProps {
  selectedDate: string;
  businessToday: string;
  onSelectDate: (date: string) => void;
  tasks: CalendarTaskDTO[];
}

export function MobileDateStrip({
  selectedDate,
  businessToday,
  onSelectDate,
  tasks,
}: MobileDateStripProps) {
  const weekDays = getWeekDays(selectedDate);

  function handlePrevWeek() {
    onSelectDate(addDays(selectedDate, -7));
  }

  function handleNextWeek() {
    onSelectDate(addDays(selectedDate, 7));
  }

  function handleToday() {
    onSelectDate(businessToday);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">
          {formatVietnameseDate(selectedDate)}
        </span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePrevWeek}
            aria-label="Tuần trước"
            className="h-9 w-9 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleToday}
            className="h-9 px-2.5 text-xs font-medium"
          >
            Hôm nay
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleNextWeek}
            aria-label="Tuần sau"
            className="h-9 w-9 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {weekDays.map((date) => {
          const isSelected = date === selectedDate;
          const isToday = date === businessToday;
          const { day } = parseIsoDate(date);
          const dow = getDayOfWeekMondayFirst(date);
          const shortWeekday = VIETNAMESE_WEEKDAYS_SHORT[dow - 1];
          const count = deriveDateMarkers(tasks, date, businessToday).length;

          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelectDate(date)}
              aria-label={`${shortWeekday} ngày ${day}${isToday ? " (Hôm nay)" : ""}${isSelected ? " (Đang chọn)" : ""}`}
              aria-pressed={isSelected}
              className={`relative flex min-h-[52px] flex-col items-center justify-center rounded-lg p-1 text-center transition-all ${
                isSelected
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : isToday
                    ? "border border-primary/40 bg-primary/5 text-foreground hover:bg-muted"
                    : "border border-transparent bg-muted/40 text-foreground hover:bg-muted"
              }`}
            >
              <span
                className={`text-[10px] font-medium uppercase tracking-wider ${
                  isSelected
                    ? "text-primary-foreground/90"
                    : "text-muted-foreground"
                }`}
              >
                {shortWeekday}
              </span>
              <span className="text-sm font-bold">{day}</span>
              {count > 0 && (
                <span
                  className={`mt-0.5 inline-block h-1.5 w-1.5 rounded-full ${
                    isSelected ? "bg-primary-foreground" : "bg-primary"
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
