import { Ticket } from "@/generated/prisma_client";

/**
 * Calculate expiry date based on issue date and ticket renewal period
 */
export function calculateExpiryDate(
  dateIssued: Date,
  renewalYears: number | null,
): Date | null {
  if (renewalYears === null) {
    // Ticket never expires
    return null;
  }

  const expiryDate = new Date(dateIssued);
  expiryDate.setFullYear(expiryDate.getFullYear() + renewalYears);

  expiryDate.setDate(expiryDate.getDate());

  return expiryDate;
}

/**
 * Check if two dates are the same (ignoring time)
 */
export function isSameDate(date1: Date | null, date2: Date | null): boolean {
  if (date1 === null && date2 === null) return true;
  if (date1 === null || date2 === null) return false;

  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Check if expiry date recalculation is needed when ticket type changes
 */
export function shouldRecalculateExpiry(
  oldTicket: Ticket | null,
  newTicket: Ticket | null,
  currentExpiryDate: Date | null,
  dateIssued: Date,
): {
  shouldShow: boolean;
  newExpiryDate: Date | null;
} {
  if (!oldTicket || !newTicket) {
    return { shouldShow: false, newExpiryDate: null };
  }

  // If renewal periods are the same, no need to recalculate
  if (oldTicket.renewal === newTicket.renewal) {
    return { shouldShow: false, newExpiryDate: null };
  }

  // Calculate what the new expiry date would be
  const calculatedExpiryDate = calculateExpiryDate(
    dateIssued,
    newTicket.renewal,
  );

  // If the calculated date is the same as current, no need to show dialog
  if (isSameDate(calculatedExpiryDate, currentExpiryDate)) {
    return { shouldShow: false, newExpiryDate: calculatedExpiryDate };
  }

  return {
    shouldShow: true,
    newExpiryDate: calculatedExpiryDate,
  };
}

/**
 * Format renewal period for display
 */
export function formatRenewalPeriod(renewalYears: number | null): string {
  if (renewalYears === null) return "Never expires";
  if (renewalYears === 1) return "Annual renewal";
  return `${renewalYears}-year renewal`;
}
