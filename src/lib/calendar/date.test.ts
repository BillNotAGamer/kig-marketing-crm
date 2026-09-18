import { describe, expect, it } from "vitest";
import {
  addDays,
  compareIsoDates,
  currentBusinessDate,
  diffDays,
  formatDayShort,
  formatIsoDate,
  formatMonthYear,
  formatVietnameseDate,
  getDayOfWeekMondayFirst,
  getDaysInMonth,
  getMondayOfWeek,
  getMonthGrid,
  getWeekDays,
  isLeapYear,
  isValidIsoDate,
  parseIsoDate,
  VIETNAMESE_WEEKDAYS,
  VIETNAMESE_WEEKDAYS_SHORT,
} from "./date";

describe("Calendar Date Utilities", () => {
  it("determines leap years accurately", () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2000)).toBe(true);
    expect(isLeapYear(2026)).toBe(false);
    expect(isLeapYear(2100)).toBe(false);
    expect(isLeapYear(1900)).toBe(false);
  });

  it("returns correct days in month including February leap year", () => {
    expect(getDaysInMonth(2024, 2)).toBe(29);
    expect(getDaysInMonth(2026, 2)).toBe(28);
    expect(getDaysInMonth(2026, 1)).toBe(31);
    expect(getDaysInMonth(2026, 4)).toBe(30);
    expect(getDaysInMonth(2026, 9)).toBe(30);
    expect(getDaysInMonth(2026, 12)).toBe(31);
  });

  it("validates ISO calendar dates strictly", () => {
    expect(isValidIsoDate("2026-09-19")).toBe(true);
    expect(isValidIsoDate("2024-02-29")).toBe(true);
    expect(isValidIsoDate("2026-02-29")).toBe(false); // not a leap year
    expect(isValidIsoDate("2026-04-31")).toBe(false); // April has 30 days
    expect(isValidIsoDate("2026-13-01")).toBe(false); // month > 12
    expect(isValidIsoDate("2026-00-01")).toBe(false); // month 0
    expect(isValidIsoDate("2026-09-00")).toBe(false); // day 0
    expect(isValidIsoDate("2026-9-19")).toBe(false); // not padded
    expect(isValidIsoDate("2026/09/19")).toBe(false);
    expect(isValidIsoDate("")).toBe(false);
    expect(isValidIsoDate(null)).toBe(false);
    expect(isValidIsoDate(undefined)).toBe(false);
    expect(isValidIsoDate(12345)).toBe(false);
  });

  it("parses and formats ISO dates deterministically", () => {
    expect(parseIsoDate("2026-09-19")).toEqual({
      year: 2026,
      month: 9,
      day: 19,
    });
    expect(() => parseIsoDate("invalid")).toThrow("Invalid ISO calendar date");
    expect(formatIsoDate(2026, 9, 19)).toBe("2026-09-19");
    expect(formatIsoDate(2026, 1, 5)).toBe("2026-01-05");
  });

  it("performs date arithmetic across month and year boundaries", () => {
    expect(addDays("2026-09-19", 1)).toBe("2026-09-20");
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29"); // leap year
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01"); // non leap year
  });

  it("calculates difference in calendar days accurately", () => {
    expect(diffDays("2026-09-01", "2026-09-05")).toBe(4);
    expect(diffDays("2026-09-05", "2026-09-01")).toBe(-4);
    expect(diffDays("2026-09-19", "2026-09-19")).toBe(0);
    expect(diffDays("2026-12-31", "2027-01-01")).toBe(1);
  });

  it("computes day of week with Monday as 1 and Sunday as 7", () => {
    // 2026-09-14 is Monday
    expect(getDayOfWeekMondayFirst("2026-09-14")).toBe(1);
    // 2026-09-19 is Saturday
    expect(getDayOfWeekMondayFirst("2026-09-19")).toBe(6);
    // 2026-09-20 is Sunday
    expect(getDayOfWeekMondayFirst("2026-09-20")).toBe(7);
  });

  it("finds the Monday of the containing week", () => {
    expect(getMondayOfWeek("2026-09-14")).toBe("2026-09-14"); // Mon -> Mon
    expect(getMondayOfWeek("2026-09-19")).toBe("2026-09-14"); // Sat -> Mon
    expect(getMondayOfWeek("2026-09-20")).toBe("2026-09-14"); // Sun -> Mon
    expect(getMondayOfWeek("2026-09-21")).toBe("2026-09-21"); // Next Mon
  });

  it("generates 7 consecutive week days from Monday to Sunday", () => {
    const days = getWeekDays("2026-09-19");
    expect(days).toHaveLength(7);
    expect(days[0]).toBe("2026-09-14");
    expect(days[6]).toBe("2026-09-20");
    days.forEach((day, index) => {
      expect(getDayOfWeekMondayFirst(day)).toBe(index + 1);
    });
  });

  it("generates complete month grids aligned to Monday", () => {
    // September 2026: 1st is Tuesday (day 2), 30th is Wednesday (day 3)
    // Grid starts Monday 2026-08-31, ends Sunday 2026-10-04 (35 days)
    const septGrid = getMonthGrid(2026, 9);
    expect(septGrid.length).toBe(35);
    expect(septGrid[0]).toBe("2026-08-31");
    expect(septGrid[septGrid.length - 1]).toBe("2026-10-04");
    expect(getDayOfWeekMondayFirst(septGrid[0])).toBe(1); // Monday
    expect(getDayOfWeekMondayFirst(septGrid[septGrid.length - 1])).toBe(7); // Sunday

    // Check invalid month
    expect(() => getMonthGrid(2026, 13)).toThrow("Invalid month");
  });

  it("compares ISO dates", () => {
    expect(compareIsoDates("2026-09-01", "2026-09-05")).toBe(-1);
    expect(compareIsoDates("2026-09-05", "2026-09-01")).toBe(1);
    expect(compareIsoDates("2026-09-19", "2026-09-19")).toBe(0);
  });

  it("formats Vietnamese dates and weekday labels correctly", () => {
    expect(VIETNAMESE_WEEKDAYS[0]).toBe("Thứ 2");
    expect(VIETNAMESE_WEEKDAYS[6]).toBe("Chủ nhật");
    expect(VIETNAMESE_WEEKDAYS_SHORT[0]).toBe("T2");
    expect(VIETNAMESE_WEEKDAYS_SHORT[6]).toBe("CN");

    expect(formatMonthYear(2026, 9)).toBe("Tháng 9, 2026");
    expect(formatVietnameseDate("2026-09-19")).toBe("Thứ 7, ngày 19/09/2026");
    expect(formatDayShort("2026-09-19")).toBe("T7 19");
  });

  it("returns current business date in Asia/Ho_Chi_Minh", () => {
    // 2026-09-18 18:00 UTC = 2026-09-19 01:00 in Asia/Ho_Chi_Minh (+7)
    const fixedTime = new Date("2026-09-18T18:00:00.000Z");
    expect(currentBusinessDate(() => fixedTime)).toBe("2026-09-19");
  });
});
