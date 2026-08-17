import { describe, expect, it } from "vitest";
import {
  addCalendarDays,
  calendarPartsInZone,
  formatDateInZone,
  formatIcsDate,
  toCalendarDay,
  toLocalCalendarDay,
} from "@/lib/dates";

/**
 * A start date of 10 Aug 2026 picked in Brisbane is persisted as the instant
 * below — local midnight, ten hours behind UTC. Every assertion here is about
 * getting "10 August" back out of it from a UTC process.
 */
const BRISBANE_START_10_AUG = new Date("2026-08-09T14:00:00.000Z");

describe("calendarPartsInZone", () => {
  it("reads the entered day, not the UTC day", () => {
    expect(calendarPartsInZone(BRISBANE_START_10_AUG)).toEqual({
      year: 2026,
      month: 8,
      day: 10,
    });
  });

  it("still reads the UTC day when asked for UTC", () => {
    expect(calendarPartsInZone(BRISBANE_START_10_AUG, "UTC")).toEqual({
      year: 2026,
      month: 8,
      day: 9,
    });
  });

  it("handles a start date that crosses a month and year boundary", () => {
    // 1 Jan 2027 in Brisbane.
    const newYear = new Date("2026-12-31T14:00:00.000Z");
    expect(calendarPartsInZone(newYear)).toEqual({
      year: 2027,
      month: 1,
      day: 1,
    });
  });

  it("survives a DST zone, where local midnight is not a fixed offset", () => {
    // 6 Oct 2026 in Sydney: the day after DST starts, so UTC+11.
    const sydney = new Date("2026-10-05T13:00:00.000Z");
    expect(calendarPartsInZone(sydney, "Australia/Sydney")).toEqual({
      year: 2026,
      month: 10,
      day: 6,
    });
  });
});

describe("addCalendarDays", () => {
  it("advances one day", () => {
    expect(addCalendarDays({ year: 2026, month: 8, day: 10 }, 1)).toEqual({
      year: 2026,
      month: 8,
      day: 11,
    });
  });

  it("rolls over month, year and leap-day boundaries", () => {
    expect(addCalendarDays({ year: 2026, month: 8, day: 31 }, 1)).toEqual({
      year: 2026,
      month: 9,
      day: 1,
    });
    expect(addCalendarDays({ year: 2026, month: 12, day: 31 }, 1)).toEqual({
      year: 2027,
      month: 1,
      day: 1,
    });
    expect(addCalendarDays({ year: 2028, month: 2, day: 28 }, 1)).toEqual({
      year: 2028,
      month: 2,
      day: 29,
    });
  });

  it("goes backwards too", () => {
    expect(addCalendarDays({ year: 2026, month: 1, day: 1 }, -1)).toEqual({
      year: 2025,
      month: 12,
      day: 31,
    });
  });
});

describe("formatIcsDate", () => {
  it("zero-pads to the VALUE=DATE form", () => {
    expect(formatIcsDate({ year: 2026, month: 8, day: 3 })).toBe("20260803");
  });

  it("produces the entered day for a Brisbane start date", () => {
    expect(formatIcsDate(calendarPartsInZone(BRISBANE_START_10_AUG))).toBe(
      "20260810",
    );
  });
});

describe("toCalendarDay", () => {
  it("returns the entered day rather than the ISO-sliced one", () => {
    expect(toCalendarDay(BRISBANE_START_10_AUG)).toBe("2026-08-10");
    expect(BRISBANE_START_10_AUG.toISOString().slice(0, 10)).toBe("2026-08-09");
  });
});

describe("formatDateInZone", () => {
  it("renders dd/MM/yyyy in the app zone", () => {
    expect(formatDateInZone(BRISBANE_START_10_AUG)).toBe("10/08/2026");
  });

  it("does not drift when the value sits near midnight UTC", () => {
    // 1 Sep 2026 in Brisbane == 31 Aug 14:00 UTC.
    expect(formatDateInZone(new Date("2026-08-31T14:00:00.000Z"))).toBe(
      "01/09/2026",
    );
  });
});

describe("toLocalCalendarDay", () => {
  it("reads the ambient-local day for picker-produced dates", () => {
    // Constructed the way a date picker does: local midnight.
    const local = new Date(2026, 0, 1);
    expect(toLocalCalendarDay(local)).toBe("2026-01-01");
  });
});
