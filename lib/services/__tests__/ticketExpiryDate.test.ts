import { describe, it, expect } from "vitest";
import { resolveTicketExpiry } from "@/lib/services/ticketExpiryDate";

const issued = new Date("2026-01-09T14:00:00.000Z");

describe("resolveTicketExpiry", () => {
  it("defaults to issued + renewal years", () => {
    expect(resolveTicketExpiry(issued, 3, null)?.toISOString()).toBe("2029-01-09T14:00:00.000Z");
  });
  it("uses an explicit expiry when given", () => {
    const e = new Date("2027-06-01T14:00:00.000Z");
    expect(resolveTicketExpiry(issued, 3, e)).toEqual(e);
  });
  it("rejects an expiry on or before the issue date", () => {
    expect(() => resolveTicketExpiry(issued, null, issued)).toThrow("INVALID_EXPIRY_DATE");
  });
  it("never-expiring ticket with no expiry → null", () => {
    expect(resolveTicketExpiry(issued, null, null)).toBeNull();
  });
});
