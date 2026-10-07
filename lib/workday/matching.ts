import { normaliseNameKey, type WorkdayRow } from "./types";

/** The employee fields matching needs. */
export interface MatchEmployee {
  id: number;
  legalFirstName: string;
  legalLastName: string;
  preferredFirstName: string | null;
  preferredLastName: string | null;
  isActive: boolean;
}

/** A remembered identity (`WorkdayLink`). `employeeId: null` = confirmed "not in HRT". */
export interface MatchLink {
  workdayNameKey: string;
  employeeId: number | null;
}

export interface MatchCandidate {
  employeeId: number;
  score: number;
  reason: string;
}

export type MatchResult =
  /** Trusted: a remembered link to an active employee, or a single exact active match. */
  | { kind: "linked"; employeeId: number; via: "link" | "exact" }
  /**
   * Only an inactive employee fits (or the remembered one is now inactive). Never trusted
   * (§7.7). `candidates` are other employees, so an active namesake can be linked instead.
   */
  | { kind: "inactive"; employeeId: number; via: "link" | "exact"; candidates: MatchCandidate[] }
  /** A link saying this person isn't in HRT. */
  | { kind: "notInHrt" }
  /** No confident match. Candidates are ranked for manual linking (§6 step 4). */
  | { kind: "unmatched"; candidates: MatchCandidate[] }
  /** Duplicate row names, or more than one active exact match. Needs a manual link. */
  | { kind: "ambiguous"; candidates: MatchCandidate[] };

/** Name keys an employee can appear under in Workday: preferred and legal, and the mixes. */
export function employeeNameKeys(e: MatchEmployee): Set<string> {
  const firsts = [e.preferredFirstName || e.legalFirstName, e.legalFirstName];
  const lasts = [e.preferredLastName || e.legalLastName, e.legalLastName];
  const keys = new Set<string>();
  for (const first of firsts) for (const last of lasts) keys.add(normaliseNameKey(`${first}${last}`));
  return keys;
}

/**
 * Match every Workday row to an HRT employee (docs/workday-org-import-spec.md §6):
 * remembered link → exact active match → exact inactive match → ranked candidates.
 * An employee claimed by one row (by link or exact match) is never offered to another.
 */
export function matchRows(
  rows: WorkdayRow[],
  employees: MatchEmployee[],
  links: MatchLink[],
): Map<string, MatchResult> {
  const results = new Map<string, MatchResult>();
  const byId = new Map(employees.map((e) => [e.id, e]));
  const linkByKey = new Map(links.map((l) => [l.workdayNameKey, l]));
  const rowCountByKey = new Map<string, number>();
  for (const row of rows) rowCountByKey.set(row.nameKey, (rowCountByKey.get(row.nameKey) ?? 0) + 1);

  // Claimed employees: linked to some name key, whether or not that row is in this file.
  const claimed = new Set<number>();
  for (const link of links) if (link.employeeId !== null && byId.has(link.employeeId)) claimed.add(link.employeeId);

  const keysById = new Map(employees.map((e) => [e.id, employeeNameKeys(e)]));
  const exact = (key: string, active: boolean) =>
    employees.filter((e) => e.isActive === active && !claimed.has(e.id) && keysById.get(e.id)!.has(key));

  // Pass 1: links and unique exact matches. Duplicate row names never auto-match.
  const pending: WorkdayRow[] = [];
  const inactiveRows: { row: WorkdayRow; employeeId: number; via: "link" | "exact" }[] = [];
  for (const row of rows) {
    const duplicate = (rowCountByKey.get(row.nameKey) ?? 0) > 1;
    const link = duplicate ? undefined : linkByKey.get(row.nameKey);

    if (link) {
      if (link.employeeId === null) {
        results.set(row.uid, { kind: "notInHrt" });
        continue;
      }
      const linked = byId.get(link.employeeId);
      if (linked) {
        if (linked.isActive) results.set(row.uid, { kind: "linked", employeeId: linked.id, via: "link" });
        else inactiveRows.push({ row, employeeId: linked.id, via: "link" });
        continue;
      }
    }

    if (!duplicate) {
      const active = exact(row.nameKey, true);
      if (active.length === 1) {
        results.set(row.uid, { kind: "linked", employeeId: active[0].id, via: "exact" });
        claimed.add(active[0].id);
        continue;
      }
      if (active.length === 0) {
        const inactive = exact(row.nameKey, false);
        if (inactive.length === 1) {
          inactiveRows.push({ row, employeeId: inactive[0].id, via: "exact" });
          continue;
        }
      }
    }
    pending.push(row);
  }

  // Pass 2: candidates, once every exact match has claimed its employee.
  for (const { row, employeeId, via } of inactiveRows) {
    const others = employees.filter((e) => e.id !== employeeId && !claimed.has(e.id));
    results.set(row.uid, { kind: "inactive", employeeId, via, candidates: rankCandidates(row, others) });
  }
  for (const row of pending) {
    const candidates = rankCandidates(row, employees.filter((e) => !claimed.has(e.id)));
    const duplicate = (rowCountByKey.get(row.nameKey) ?? 0) > 1;
    const multipleExact = exact(row.nameKey, true).length > 1;
    results.set(row.uid, duplicate || multipleExact
      ? { kind: "ambiguous", candidates }
      : { kind: "unmatched", candidates });
  }

  return results;
}

/**
 * Candidates for a row with no confident match: same surname, ranked by first-name
 * similarity, active before inactive. Real cases: Fred/Frederik Botma, Nick/Nicholas
 * Todeschino, Maree/Rosemaree Toa, Tommy/Muhamad Hamim (surname only).
 */
export function rankCandidates(row: WorkdayRow, employees: MatchEmployee[]): MatchCandidate[] {
  const out: (MatchCandidate & { active: boolean })[] = [];

  for (const e of employees) {
    const surnames = unique([e.legalLastName, e.preferredLastName].filter(isNonEmpty).map(normaliseNameKey));
    const surname = surnames.find((s) => s && row.nameKey.endsWith(s) && row.nameKey.length > s.length);
    if (!surname) continue;

    const rowFirst = row.nameKey.slice(0, row.nameKey.length - surname.length);
    const firsts = unique([e.legalFirstName, e.preferredFirstName].filter(isNonEmpty).map(normaliseNameKey));

    let score = 50;
    let reason = "Same surname";
    for (const first of firsts) {
      if (first === rowFirst) {
        [score, reason] = [Math.max(score, 90), "Same name"];
      } else if (commonPrefix(first, rowFirst) >= 3) {
        if (score < 80) [score, reason] = [80, "Same surname, similar first name"];
      } else if (first.includes(rowFirst) || rowFirst.includes(first)) {
        if (score < 70) [score, reason] = [70, "Same surname, first name contains the other"];
      }
    }
    out.push({ employeeId: e.id, score, reason, active: e.isActive });
  }

  return out
    .sort((a, b) => Number(b.active) - Number(a.active) || b.score - a.score || a.employeeId - b.employeeId)
    .map(({ employeeId, score, reason, active }) => ({
      employeeId,
      score,
      reason: active ? reason : `${reason} (inactive)`,
    }));
}

function commonPrefix(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function isNonEmpty(value: string | null): value is string {
  return !!value && value.trim().length > 0;
}
