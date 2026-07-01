export interface RevisionLite {
  id: number;
  effectiveDate: Date;
  createdAt: Date;
  overrideRequiresRetraining: boolean | null;
}

export interface TrainingLite {
  requiresRetrainingOnRevision: boolean;
  revisions: RevisionLite[];
}

/** Is `a` later than `b`? effectiveDate desc, then createdAt desc, then id desc (spec §3.2). */
function isLaterRevision(a: RevisionLite, b: RevisionLite): boolean {
  if (a.effectiveDate.getTime() !== b.effectiveDate.getTime())
    return a.effectiveDate.getTime() > b.effectiveDate.getTime();
  if (a.createdAt.getTime() !== b.createdAt.getTime())
    return a.createdAt.getTime() > b.createdAt.getTime();
  return a.id > b.id;
}

/** Current revision = newest effectiveDate <= now; null if none is in effect yet (pre-staging). */
export function currentRevision(revisions: RevisionLite[], now: Date): RevisionLite | null {
  let best: RevisionLite | null = null;
  for (const r of revisions) {
    if (r.effectiveDate.getTime() > now.getTime()) continue;
    if (best === null || isLaterRevision(r, best)) best = r;
  }
  return best;
}

/**
 * Does this employee's set of records for ONE training satisfy it?
 *   case 1 — no current revision (none, or all future): any record satisfies.
 *   case 2 — current revision does not require retraining: any record satisfies.
 *   case 3 — current revision requires retraining: needs a record stamped with the current revisionId;
 *            a revisionId === null record ALSO counts (adopting the feature never retroactively
 *            invalidates anyone).
 * Exemptions are handled separately by the caller.
 */
export function isTrainingSatisfied(
  records: { revisionId: number | null }[],
  training: TrainingLite,
  now: Date,
): boolean {
  if (records.length === 0) return false;
  const cur = currentRevision(training.revisions, now);
  if (cur === null) return true; // case 1
  const requiresRetraining = cur.overrideRequiresRetraining ?? training.requiresRetrainingOnRevision;
  if (!requiresRetraining) return true; // case 2
  return records.some((r) => r.revisionId === null || r.revisionId === cur.id); // case 3
}
