import { calculateExpiryDate } from "@/lib/expiry-utils";

/**
 * The expiry a ticket record gets. Shared by manual entry (ticketRecordService) and document
 * approval so both enforce the same rules: an explicit expiry must be after the issue date, and
 * otherwise it is issue + renewal years (null for a ticket that never expires).
 */
export function resolveTicketExpiry(
  dateIssued: Date,
  renewalYears: number | null,
  explicitExpiry: Date | null,
): Date | null {
  if (explicitExpiry) {
    if (Number.isNaN(explicitExpiry.getTime()) || explicitExpiry.getTime() <= dateIssued.getTime()) {
      throw new Error("INVALID_EXPIRY_DATE");
    }
    return explicitExpiry;
  }
  const calculated = calculateExpiryDate(dateIssued, renewalYears);
  if (renewalYears !== null && !calculated) throw new Error("EXPIRY_DATE_REQUIRED");
  return calculated;
}
