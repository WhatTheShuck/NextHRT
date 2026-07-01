/** A record is "valid" if it never expires (null) or expires strictly after `now`. */
export function isTicketRecordValid(
  record: { expiryDate: Date | null },
  now: Date,
): boolean {
  return record.expiryDate === null || record.expiryDate.getTime() > now.getTime();
}

/**
 * An employee satisfies a required ticket if they hold at least one valid record
 * for it. Spec §5.2 — expired records (expiryDate <= now) no longer count, with no
 * grace period. Exemptions are handled separately by the caller.
 */
export function isTicketSatisfied(
  records: { expiryDate: Date | null }[],
  now: Date,
): boolean {
  return records.some((r) => isTicketRecordValid(r, now));
}
