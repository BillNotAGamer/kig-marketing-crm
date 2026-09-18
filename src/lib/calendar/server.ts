import "server-only";
import { getDb } from "@/db";
import { getServerEnv } from "@/lib/env";
import { calendarService } from "./service";
import { calendarHttp } from "./http";

export function getCalendar() {
  return calendarService(getDb(), getServerEnv());
}

export function handleCalendar(request: Request) {
  return calendarHttp(request, getCalendar());
}
