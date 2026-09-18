import { currentBusinessDate as getBusinessDate } from "../tasks/validation";

export interface ParsedIsoDate {
  year: number;
  month: number;
  day: number;
}

export const VIETNAMESE_WEEKDAYS = [
  "Thứ 2",
  "Thứ 3",
  "Thứ 4",
  "Thứ 5",
  "Thứ 6",
  "Thứ 7",
  "Chủ nhật",
] as const;

export const VIETNAMESE_WEEKDAYS_SHORT = [
  "T2",
  "T3",
  "T4",
  "T5",
  "T6",
  "T7",
  "CN",
] as const;

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function getDaysInMonth(year: number, month: number): number {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }
  if ([4, 6, 9, 11].includes(month)) {
    return 30;
  }
  return 31;
}

export function isValidIsoDate(str: unknown): str is string {
  if (typeof str !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return false;
  }
  const [yearStr, monthStr, dayStr] = str.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (year < 1000 || year > 9999 || month < 1 || month > 12) {
    return false;
  }
  const maxDay = getDaysInMonth(year, month);
  return day >= 1 && day <= maxDay;
}

export function parseIsoDate(iso: string): ParsedIsoDate {
  if (!isValidIsoDate(iso)) {
    throw new Error(`Invalid ISO calendar date: ${iso}`);
  }
  const [y, m, d] = iso.split("-").map(Number);
  return { year: y, month: m, day: d };
}

export function formatIsoDate(
  year: number,
  month: number,
  day: number,
): string {
  const y = String(year).padStart(4, "0");
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(iso: string, days: number): string {
  const { year, month, day } = parseIsoDate(iso);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  utcDate.setUTCDate(utcDate.getUTCDate() + days);
  return formatIsoDate(
    utcDate.getUTCFullYear(),
    utcDate.getUTCMonth() + 1,
    utcDate.getUTCDate(),
  );
}

export function diffDays(aIso: string, bIso: string): number {
  const a = parseIsoDate(aIso);
  const b = parseIsoDate(bIso);
  const aUtc = Date.UTC(a.year, a.month - 1, a.day);
  const bUtc = Date.UTC(b.year, b.month - 1, b.day);
  return Math.round((bUtc - aUtc) / 86400000);
}

/**
 * Returns Monday=1, Tuesday=2, ..., Sunday=7.
 */
export function getDayOfWeekMondayFirst(iso: string): number {
  const { year, month, day } = parseIsoDate(iso);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  const dow = utcDate.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  return dow === 0 ? 7 : dow;
}

export function getMondayOfWeek(iso: string): string {
  const dow = getDayOfWeekMondayFirst(iso);
  return addDays(iso, -(dow - 1));
}

export function getWeekDays(iso: string): string[] {
  const monday = getMondayOfWeek(iso);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export function getMonthGrid(year: number, month: number): string[] {
  if (month < 1 || month > 12) {
    throw new Error(`Invalid month: ${month}`);
  }
  const firstDay = formatIsoDate(year, month, 1);
  const startMonday = getMondayOfWeek(firstDay);
  const lastDayOfMonth = formatIsoDate(
    year,
    month,
    getDaysInMonth(year, month),
  );
  const lastMonday = getMondayOfWeek(lastDayOfMonth);
  const endSunday = addDays(lastMonday, 6);

  const totalDays = diffDays(startMonday, endSunday) + 1;
  return Array.from({ length: totalDays }, (_, i) => addDays(startMonday, i));
}

export function compareIsoDates(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function currentBusinessDate(clock = () => new Date()): string {
  return getBusinessDate(clock());
}

export function formatMonthYear(year: number, month: number): string {
  return `Tháng ${month}, ${year}`;
}

export function formatVietnameseDate(iso: string): string {
  const { year, month, day } = parseIsoDate(iso);
  const dow = getDayOfWeekMondayFirst(iso);
  const weekdayName = VIETNAMESE_WEEKDAYS[dow - 1];
  const d = String(day).padStart(2, "0");
  const m = String(month).padStart(2, "0");
  return `${weekdayName}, ngày ${d}/${m}/${year}`;
}

export function formatDayShort(iso: string): string {
  const { day } = parseIsoDate(iso);
  const dow = getDayOfWeekMondayFirst(iso);
  const shortName = VIETNAMESE_WEEKDAYS_SHORT[dow - 1];
  return `${shortName} ${day}`;
}
