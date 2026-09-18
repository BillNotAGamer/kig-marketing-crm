"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Columns, Grid3X3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  addDays,
  formatIsoDate,
  formatMonthYear,
  getDaysInMonth,
  getMondayOfWeek,
  parseIsoDate,
} from "@/lib/calendar/date";
import type { CalendarTaskDTO } from "@/lib/calendar/model";
import { MonthView } from "./month-view";
import { WeekView } from "./week-view";
import { MobileDateStrip } from "./mobile-date-strip";
import { DateAgenda } from "./date-agenda";

interface CalendarShellProps {
  initialTasks: CalendarTaskDTO[];
  businessToday: string;
  initialView: "month" | "week";
  initialDate: string;
  isTeamReader: boolean;
}

export function CalendarShell({
  initialTasks,
  businessToday,
  initialView,
  initialDate,
  isTeamReader,
}: CalendarShellProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [view, setView] = useState<"month" | "week">(initialView);
  const [selectedDate, setSelectedDate] = useState<string>(initialDate);

  const { year, month } = parseIsoDate(selectedDate);

  function navigateTo(newDate: string, newView = view) {
    setSelectedDate(newDate);
    startTransition(() => {
      router.push(`/calendar?view=${newView}&date=${newDate}`);
    });
  }

  function handlePrevPeriod() {
    if (view === "month") {
      // Go to previous month
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      const maxDays = getDaysInMonth(prevYear, prevMonth);
      const targetDay = Math.min(parseIsoDate(selectedDate).day, maxDays);
      navigateTo(formatIsoDate(prevYear, prevMonth, targetDay));
    } else {
      // Go to previous week
      navigateTo(addDays(selectedDate, -7));
    }
  }

  function handleNextPeriod() {
    if (view === "month") {
      // Go to next month
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      const maxDays = getDaysInMonth(nextYear, nextMonth);
      const targetDay = Math.min(parseIsoDate(selectedDate).day, maxDays);
      navigateTo(formatIsoDate(nextYear, nextMonth, targetDay));
    } else {
      // Go to next week
      navigateTo(addDays(selectedDate, 7));
    }
  }

  function handleToday() {
    navigateTo(businessToday);
  }

  function handleViewChange(newView: "month" | "week") {
    setView(newView);
    navigateTo(selectedDate, newView);
  }

  const weekMonday = getMondayOfWeek(selectedDate);
  const weekSunday = addDays(weekMonday, 6);
  const { day: monDay, month: monMonth } = parseIsoDate(weekMonday);
  const {
    day: sunDay,
    month: sunMonth,
    year: sunYear,
  } = parseIsoDate(weekSunday);

  const periodTitle =
    view === "month"
      ? formatMonthYear(year, month)
      : `Tuần: ${monDay}/${monMonth} – ${sunDay}/${sunMonth}/${sunYear}`;

  return (
    <div className="space-y-6">
      {/* Mobile Agenda-First Presentation */}
      <div className="space-y-4 sm:hidden">
        <MobileDateStrip
          selectedDate={selectedDate}
          businessToday={businessToday}
          onSelectDate={(d) => navigateTo(d)}
          tasks={initialTasks}
        />
        <DateAgenda
          tasks={initialTasks}
          selectedDate={selectedDate}
          businessToday={businessToday}
          isTeamReader={isTeamReader}
        />
      </div>

      {/* Desktop Calendar Presentation */}
      <div className="hidden space-y-6 sm:block">
        {/* Top Controls Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight">{periodTitle}</h2>
            {isPending && (
              <span className="text-xs text-muted-foreground animate-pulse">
                Đang tải...
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Previous / Today / Next Navigation */}
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePrevPeriod}
                aria-label="Kỳ trước"
                className="h-9 w-9 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleToday}
                className="h-9 px-3 text-xs font-semibold"
              >
                Hôm nay
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleNextPeriod}
                aria-label="Kỳ sau"
                className="h-9 w-9 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* View Switcher: Month / Week */}
            <div className="flex items-center rounded-lg border bg-muted p-0.5">
              <button
                type="button"
                onClick={() => handleViewChange("month")}
                aria-pressed={view === "month"}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  view === "month"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Grid3X3 className="h-3.5 w-3.5" />
                <span>Tháng</span>
              </button>
              <button
                type="button"
                onClick={() => handleViewChange("week")}
                aria-pressed={view === "week"}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  view === "week"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Columns className="h-3.5 w-3.5" />
                <span>Tuần</span>
              </button>
            </div>
          </div>
        </div>

        {/* Main Grid: Month or Week View */}
        <div className="rounded-xl border bg-card p-4 sm:p-6">
          {view === "month" ? (
            <MonthView
              year={year}
              month={month}
              selectedDate={selectedDate}
              businessToday={businessToday}
              tasks={initialTasks}
              onSelectDate={(d) => navigateTo(d)}
              isTeamReader={isTeamReader}
            />
          ) : (
            <WeekView
              selectedDate={selectedDate}
              businessToday={businessToday}
              tasks={initialTasks}
              onSelectDate={(d) => navigateTo(d)}
              isTeamReader={isTeamReader}
            />
          )}
        </div>

        {/* Selected Date Agenda Details */}
        <div className="rounded-xl border bg-card p-4 sm:p-6">
          <DateAgenda
            tasks={initialTasks}
            selectedDate={selectedDate}
            businessToday={businessToday}
            isTeamReader={isTeamReader}
          />
        </div>
      </div>
    </div>
  );
}
