// Pure helpers shared by TICKET_EXPIRY, the Expiring & Missing page and the go-live script.

export const DAY_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_EMPLOYEE_MILESTONES = [365, 180, 90, 30];
export const DEFAULT_MANAGER_MILESTONES = [30];

interface RecordLite {
  id: number;
  employeeId: number;
  ticketId: number;
  expiryDate: Date | null;
  dateIssued: Date;
}

function isNewer(a: RecordLite, b: RecordLite): boolean {
  const ae = a.expiryDate?.getTime() ?? Infinity; // null expiry = never expires = newest
  const be = b.expiryDate?.getTime() ?? Infinity;
  if (ae !== be) return ae > be;
  if (a.dateIssued.getTime() !== b.dateIssued.getTime()) return a.dateIssued > b.dateIssued;
  return a.id > b.id;
}

/** The current record per (employee, ticket): latest expiry, tie dateIssued, tie id. */
export function pickCurrentRecords<T extends RecordLite>(records: T[]): T[] {
  const best = new Map<string, T>();
  for (const r of records) {
    const key = `${r.employeeId}:${r.ticketId}`;
    const cur = best.get(key);
    if (!cur || isNewer(r, cur)) best.set(key, r);
  }
  return [...best.values()];
}

/** Comma-separated day milestones → deduped, descending. Falls back to `defaults`. */
export function parseMilestones(raw: string | undefined, defaults: number[]): number[] {
  const parsed = (raw ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  const list = parsed.length > 0 ? parsed : defaults;
  return [...new Set(list)].sort((a, b) => b - a);
}

/** Smallest milestone still covering `days`; null when beyond the furthest. */
export function applicableMilestone(days: number, milestones: number[]): number | null {
  let result: number | null = null;
  for (const m of milestones) if (days <= m) result = m;
  return result;
}

export type ExpiryState = { expired: true } | { expired: false; days: number };

/**
 * The stage to record (and notify for) on this run, or null when nothing is due. A stage is the
 * days-value of the last milestone sent, or "ExpiredSent". Legacy values ("WarnSent") parse as
 * nothing-sent and re-warn once at the right milestone.
 */
export function nextStage(stage: string | null, state: ExpiryState, milestones: number[]): string | null {
  if (state.expired) return stage === "ExpiredSent" ? null : "ExpiredSent";
  const milestone = applicableMilestone(state.days, milestones);
  if (milestone === null) return null;
  const lastSent = /^\d+$/.test(stage ?? "") ? Number(stage) : null;
  if (lastSent !== null && milestone >= lastSent) return null;
  return String(milestone);
}
