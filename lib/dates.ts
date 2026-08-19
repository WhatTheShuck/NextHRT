/**
 * Timezone-safe helpers for *date-only* values (start dates, expiry dates,
 * completion dates …).
 *
 * The app stores these as instants built from a **local-midnight** `Date` — see
 * `DateSelector`, which hands the form a `Date` at 00:00 in the browser's zone,
 * and the form then calls `.toISOString()`. In Brisbane (UTC+10) the start date
 * "10 Aug 2026" is therefore persisted as `2026-08-09T14:00:00.000Z`.
 *
 * That round-trips fine in the browser, but the production container runs with
 * `TZ` unset (UTC), so any server-side `getDate()` / `toLocaleDateString()` /
 * `toISOString().slice(0, 10)` reads the *previous* calendar day. That is the
 * off-by-one that reached managers' calendars.
 *
 * Everything here reads the calendar day in an explicit zone instead of the
 * ambient one, so the answer no longer depends on where the process runs.
 */

/**
 * The organisation's calendar zone: the zone the dates were entered in, and the
 * one they should be read back in. Overridable per deployment.
 */
export const APP_TIME_ZONE = process.env.APP_TIME_ZONE || "Australia/Brisbane";

export interface CalendarParts {
  year: number;
  /** 1-12, not the 0-based month `Date` uses. */
  month: number;
  day: number;
}

const partsFormatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = partsFormatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    partsFormatterCache.set(timeZone, formatter);
  }
  return formatter;
}

/** The calendar day `date` falls on when viewed in `timeZone`. */
export function calendarPartsInZone(
  date: Date,
  timeZone: string = APP_TIME_ZONE,
): CalendarParts {
  const parts = partsFormatter(timeZone).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
  };
}

/** Shift a calendar day by whole days, without ever touching a DST boundary. */
export function addCalendarDays(
  parts: CalendarParts,
  days: number,
): CalendarParts {
  // UTC has no DST, so arithmetic on a UTC instant is pure day arithmetic.
  const shifted = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day) + days * 86_400_000,
  );
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** `yyyy-MM-dd` — for `<input type="date">`, API query params and log lines. */
export function formatCalendarParts(parts: CalendarParts): string {
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

/** `yyyy-MM-dd` for `date`, read in `timeZone`. */
export function toCalendarDay(
  date: Date,
  timeZone: string = APP_TIME_ZONE,
): string {
  return formatCalendarParts(calendarPartsInZone(date, timeZone));
}

/** `yyyyMMdd` — the ICS `VALUE=DATE` form used by all-day events. */
export function formatIcsDate(parts: CalendarParts): string {
  return `${parts.year}${pad(parts.month)}${pad(parts.day)}`;
}

/**
 * Format a date-only value for humans, pinned to `timeZone` so the rendered day
 * matches the day that was entered. Defaults to `dd/MM/yyyy`.
 */
export function formatDateInZone(
  date: Date,
  options: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  },
  locale = "en-AU",
  timeZone: string = APP_TIME_ZONE,
): string {
  return date.toLocaleDateString(locale, { ...options, timeZone });
}

/**
 * Format a true timestamp (something that happened at an instant, e.g.
 * `completedAt`) in the app zone rather than the server's.
 */
export function formatDateTimeInZone(
  date: Date,
  options: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  },
  locale = "en-AU",
  timeZone: string = APP_TIME_ZONE,
): string {
  return date.toLocaleString(locale, { ...options, timeZone });
}

/**
 * Today's calendar day in the app zone, as `yyyy-MM-dd`. Use instead of
 * `new Date().toISOString().split("T")[0]`, which returns yesterday for the
 * whole Brisbane morning.
 */
export function todayCalendarDay(timeZone: string = APP_TIME_ZONE): string {
  return toCalendarDay(new Date(), timeZone);
}

/**
 * `yyyy-MM-dd` for a `Date` that already represents a *local* calendar day
 * (i.e. one produced by a date picker in the user's browser). Reads the
 * ambient-local day deliberately — the counterpart to `toCalendarDay` for
 * client-side values that never went through storage.
 */
export function toLocalCalendarDay(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
