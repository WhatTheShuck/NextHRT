import { describe, expect, it } from "vitest";
import { buildCalendarInvite } from "@/lib/calendar-invite";

/** A start date of 10 Aug 2026 as entered in Brisbane and stored by the form. */
const BRISBANE_START_10_AUG = new Date("2026-08-09T14:00:00.000Z");

/** The invite always carries inline content; narrow it for the assertions. */
function icsFor(requestId: number, startDate: Date, name: string): string {
  const { content } = buildCalendarInvite(requestId, startDate, name);
  expect(typeof content).toBe("string");
  return content as string;
}

function line(ics: string, prefix: string): string {
  return ics.split("\r\n").find((l) => l.startsWith(prefix)) ?? "";
}

describe("buildCalendarInvite", () => {
  it("puts the event on the entered start date, not the UTC one", () => {
    const content = icsFor(7, BRISBANE_START_10_AUG, "Ada Lovelace");
    expect(line(content, "DTSTART")).toBe("DTSTART;VALUE=DATE:20260810");
  });

  it("ends the all-day event on the exclusive next day", () => {
    const content = icsFor(7, BRISBANE_START_10_AUG, "Ada Lovelace");
    expect(line(content, "DTEND")).toBe("DTEND;VALUE=DATE:20260811");
  });

  it("rolls DTEND into the next month when the start date is month-end", () => {
    // 31 Aug 2026 in Brisbane.
    const content = icsFor(8, new Date("2026-08-30T14:00:00.000Z"), "Grace Hopper");
    expect(line(content, "DTSTART")).toBe("DTSTART;VALUE=DATE:20260831");
    expect(line(content, "DTEND")).toBe("DTEND;VALUE=DATE:20260901");
  });

  it("handles a start date on New Year's Day", () => {
    const content = icsFor(9, new Date("2026-12-31T14:00:00.000Z"), "Alan Turing");
    expect(line(content, "DTSTART")).toBe("DTSTART;VALUE=DATE:20270101");
    expect(line(content, "DTEND")).toBe("DTEND;VALUE=DATE:20270102");
  });

  it("emits a well-formed all-day, non-blocking event", () => {
    const { filename, contentType } = buildCalendarInvite(
      7,
      BRISBANE_START_10_AUG,
      "Ada Lovelace",
    );
    const content = icsFor(7, BRISBANE_START_10_AUG, "Ada Lovelace");
    expect(filename).toBe("invite.ics");
    expect(contentType).toBe("text/calendar");
    expect(content.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(content.endsWith("\r\nEND:VCALENDAR")).toBe(true);
    expect(line(content, "UID:")).toBe("UID:onboarding-7@ksb.com");
    expect(line(content, "TRANSP:")).toBe("TRANSP:TRANSPARENT");
    expect(line(content, "SUMMARY:")).toBe("SUMMARY:First day: Ada Lovelace");
    expect(line(content, "DTSTAMP:")).toMatch(/^DTSTAMP:\d{8}T\d{6}Z$/);
  });
});
