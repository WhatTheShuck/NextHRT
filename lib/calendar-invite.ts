import type { MailAttachment } from "@/lib/services/mailService";
import { addCalendarDays, calendarPartsInZone, formatIcsDate } from "@/lib/dates";

/**
 * Returns an ICS calendar attachment for an all-day "free" event on `startDate`.
 * `TRANSP:TRANSPARENT` means it shows as "not busy" in the recipient's calendar.
 *
 * Lives outside the fan-out service so it can be exercised directly — the day
 * this event lands on has been wrong more than once.
 */
export function buildCalendarInvite(
  requestId: number,
  startDate: Date,
  employeeName: string,
): MailAttachment {
  const pad = (n: number) => String(n).padStart(2, "0");
  // Read the calendar day in the app zone, not the server's: production runs as
  // UTC and `startDate` is a local-midnight instant, so the ambient getters land
  // a day early. DTEND on an all-day event is exclusive, hence +1.
  const startParts = calendarPartsInZone(startDate);
  const dateStr = formatIcsDate(startParts);
  const nextDateStr = formatIcsDate(addCalendarDays(startParts, 1));
  const now = new Date();
  const dtstamp =
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//KSB//HRT//EN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:onboarding-${requestId}@ksb.com`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${dateStr}`,
    `DTEND;VALUE=DATE:${nextDateStr}`,
    `SUMMARY:First day: ${employeeName}`,
    `DESCRIPTION:New hire start date for ${employeeName}.`,
    "STATUS:CONFIRMED",
    "TRANSP:TRANSPARENT",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return { filename: "invite.ics", content: ics, contentType: "text/calendar" };
}
