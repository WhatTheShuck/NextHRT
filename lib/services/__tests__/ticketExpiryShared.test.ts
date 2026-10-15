import { describe, it, expect } from "vitest";
import { pickCurrentRecords, parseMilestones, nextStage } from "@/lib/services/ticketExpiryShared";

const d = (s: string) => new Date(s);

describe("pickCurrentRecords", () => {
  it("latest expiry wins per employee+ticket; null expiry is newest", () => {
    const recs = [
      { id: 1, employeeId: 1, ticketId: 1, expiryDate: d("2026-01-01"), dateIssued: d("2023-01-01") },
      { id: 2, employeeId: 1, ticketId: 1, expiryDate: d("2029-01-01"), dateIssued: d("2026-01-01") },
      { id: 3, employeeId: 2, ticketId: 1, expiryDate: d("2026-01-01"), dateIssued: d("2023-01-01") },
      { id: 4, employeeId: 2, ticketId: 1, expiryDate: null, dateIssued: d("2020-01-01") },
    ];
    expect(pickCurrentRecords(recs).map((r) => r.id).sort()).toEqual([2, 4]);
  });
});

describe("parseMilestones", () => {
  it("parses, dedupes, sorts descending, falls back to defaults", () => {
    expect(parseMilestones("30, 90,90,x", [7])).toEqual([90, 30]);
    expect(parseMilestones("", [365, 30])).toEqual([365, 30]);
  });
  it("accepts whole days only", () => {
    expect(parseMilestones("30.5,90", [7])).toEqual([90]);
  });
});

describe("nextStage", () => {
  const ms = [365, 90, 30];
  it("first warning at the tightest applicable milestone", () => {
    expect(nextStage(null, { expired: false, days: 80 }, ms)).toBe("90");
  });
  it("no repeat at the same milestone", () => {
    expect(nextStage("90", { expired: false, days: 60 }, ms)).toBeNull();
  });
  it("advances to a nearer milestone", () => {
    expect(nextStage("90", { expired: false, days: 20 }, ms)).toBe("30");
  });
  it("beyond the furthest milestone → nothing", () => {
    expect(nextStage(null, { expired: false, days: 400 }, ms)).toBeNull();
  });
  it("expired once", () => {
    expect(nextStage("30", { expired: true }, ms)).toBe("ExpiredSent");
    expect(nextStage("ExpiredSent", { expired: true }, ms)).toBeNull();
  });
  it("legacy WarnSent re-warns once", () => {
    expect(nextStage("WarnSent", { expired: false, days: 20 }, ms)).toBe("30");
  });
});
