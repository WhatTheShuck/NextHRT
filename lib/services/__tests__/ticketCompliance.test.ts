import { describe, it, expect } from "vitest";
import { isTicketSatisfied } from "@/lib/services/ticketCompliance";

const now = new Date("2026-06-24T00:00:00Z");
const future = new Date("2027-01-01T00:00:00Z");
const past = new Date("2026-01-01T00:00:00Z");

describe("isTicketSatisfied", () => {
  it("returns false when there are no records", () => {
    expect(isTicketSatisfied([], now)).toBe(false);
  });

  it("is satisfied by a record with a future expiry", () => {
    expect(isTicketSatisfied([{ expiryDate: future }], now)).toBe(true);
  });

  it("is satisfied by a record with null expiry (never expires)", () => {
    expect(isTicketSatisfied([{ expiryDate: null }], now)).toBe(true);
  });

  it("is NOT satisfied when the only record is expired", () => {
    expect(isTicketSatisfied([{ expiryDate: past }], now)).toBe(false);
  });

  it("is satisfied if ANY record is still valid even when others are expired", () => {
    expect(isTicketSatisfied([{ expiryDate: past }, { expiryDate: future }], now)).toBe(true);
  });

  it("treats expiry exactly equal to now as expired (no grace period)", () => {
    expect(isTicketSatisfied([{ expiryDate: now }], now)).toBe(false);
  });
});
