import { Calendar as CalendarIcon } from "lucide-react";
import { formatVietnameseDate } from "@/lib/calendar/date";
import { deriveDateMarkers, type CalendarTaskDTO } from "@/lib/calendar/model";
import { TaskCalendarCard } from "./task-calendar-card";

interface DateAgendaProps {
  tasks: CalendarTaskDTO[];
  selectedDate: string;
  businessToday: string;
  isTeamReader: boolean;
}

export function DateAgenda({
  tasks,
  selectedDate,
  businessToday,
  isTeamReader,
}: DateAgendaProps) {
  const markers = deriveDateMarkers(tasks, selectedDate, businessToday);
  const isToday = selectedDate === businessToday;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight">
              Agenda: {formatVietnameseDate(selectedDate)}
            </h2>
            {isToday && (
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                Hôm nay
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {markers.length === 0
              ? "Không có công việc nào"
              : `${markers.length} công việc có mốc sự kiện trong ngày`}
          </p>
        </div>
      </div>

      {markers.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card/50 p-8 text-center text-muted-foreground">
          <CalendarIcon className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-2 text-sm font-medium">
            Không có công việc nào vào ngày này
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Không có công việc nào được giao hoặc đến hạn vào {selectedDate}.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {markers.map((marker) => (
            <TaskCalendarCard
              key={`${marker.task.id}-${marker.markerType}`}
              marker={marker}
              isTeamReader={isTeamReader}
            />
          ))}
        </div>
      )}
    </section>
  );
}
