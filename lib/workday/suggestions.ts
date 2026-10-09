import { deriveEmploymentType } from "@/lib/employment";
import { emailNamePart } from "@/lib/employee-email";
import type { EmployeeStatus } from "@/generated/prisma_client/client";
import type { MatchCandidate, MatchResult } from "./matching";
import { normaliseNameKey, normaliseText, rowLinkKeys, type WorkdayRow } from "./types";

/**
 * The suggestion engine (docs/workday-org-import-spec.md §7–8). Pure: everything it needs is
 * passed in, and it returns the lines for the review screen. Lines are always recomputed from
 * the stored rows plus current HRT data; nothing is applied from a stored suggestion.
 */

export const MISSING_FROM_WORKDAY_GRACE_DAYS = 30;

/** Title words that suggest someone oversees others (§8.2). "Forman" is in the real data. */
const OVERSIGHT_WORDS =
  /\b(co-?ordinator|supervisor|(?<!document )controller|planner|scheduler|administrator|leading hand|fore?man|forman)\b/i;

export type LineField =
  | "reportsTo"
  | "title"
  | "preferredName"
  | "department"
  | "delegatedAccess"
  | "staleDelegatedAccess"
  | "externalReportsTo"
  | "externalManagerLeft"
  | "notInHrt"
  | "inactiveMatch"
  | "missingFromWorkday";

export { FLAG_FIELDS } from "./labels";

export type LineChange =
  | { kind: "reportsTo"; employeeId: number; reportsToId: number | null }
  | { kind: "title"; employeeId: number; title: string }
  | { kind: "preferredName"; employeeId: number; preferredFirstName: string | null; preferredLastName: string | null }
  | { kind: "department"; employeeId: number; departmentId: number }
  | {
      kind: "delegatedAccess";
      granteeEmployeeId: number;
      scopeManagerEmployeeId: number;
      departmentId: number | null;
      source: "WorkdayStructural" | "WorkdayTitle";
    }
  | { kind: "removeDelegatedAccess"; grantId: number; granteeEmployeeId: number };

export interface LineNote {
  level: "info" | "warning";
  text: string;
}

export interface LinePerson {
  employeeId: number;
  name: string;
  reason?: string;
  score?: number;
}

export interface Line {
  /** Stable across recalculations: `subjectKey~field~value` (§7). */
  id: string;
  subjectKey: string;
  field: LineField;
  value: string;
  /** The HRT employee the line is about, if any. */
  employeeId: number | null;
  /** The Workday row the line came from, if any. */
  workdayUid: string | null;
  workdayName: string | null;
  /** HRT display name of `employeeId`, for lines with no Workday row. */
  employeeName: string | null;
  current: string | null;
  proposed: string | null;
  reason: string | null;
  notes: LineNote[];
  /** Why it can't be applied yet, e.g. "Link Brett Lewis first". */
  blocked: string | null;
  /** What applying writes. Absent on flags and blocked lines. */
  change?: LineChange;
  /** Link targets for notInHrt / inactiveMatch lines. */
  candidates?: LinePerson[];
  /** Choices for an externalReportsTo line with more than one possible manager. */
  options?: LinePerson[];
  /** notInHrt only: someone already confirmed this row isn't in HRT. */
  confirmedNotInHrt?: boolean;
  /** preferredName only: the suggested first/last split of Workday's name, editable before ticking (§7.3). */
  split?: { first: string; last: string };
  /** delegatedAccess (Signal B) only: the department filter can be changed before ticking (§8.2). */
  departmentEditable?: boolean;
}

export interface SuggestEmployee {
  id: number;
  legalFirstName: string;
  legalLastName: string;
  preferredFirstName: string | null;
  preferredLastName: string | null;
  title: string;
  isActive: boolean;
  status: EmployeeStatus;
  startDate: Date;
  departmentId: number;
  reportsToId: number | null;
  userEmail: string | null;
  userRole: string | null;
}

export interface SuggestInput {
  rows: WorkdayRow[];
  matches: Map<string, MatchResult>;
  employees: SuggestEmployee[];
  departments: { id: number; name: string; parentDepartmentId: number | null }[];
  ignoreRules: { subjectKey: string; field: string; value: string }[];
  existingGrants: {
    id: number;
    granteeEmployeeId: number;
    scopeManagerEmployeeId: number;
    departmentId: number | null;
  }[];
  /** employeeId → the manager named on the onboarding request that created them (§7.10). */
  onboardingManagers: Map<number, number>;
  /** departmentId → employee ids of users who manage that department today (§7.10). */
  departmentManagers: Map<number, number[]>;
  /** Line-manager authority is switched on, so a delegated grant takes effect when applied. */
  lineManagerAuthority?: boolean;
  now: Date;
}

export interface SuggestResult {
  lines: Line[];
  ignoredCount: number;
  /** Workday uid → linked active employee id. */
  linkedEmployees: Map<string, number>;
}

export function lineId(subjectKey: string, field: LineField, value: string): string {
  return `${subjectKey}~${field}~${value}`;
}

export function displayName(e: Pick<SuggestEmployee, "legalFirstName" | "legalLastName" | "preferredFirstName" | "preferredLastName">): string {
  return `${e.preferredFirstName || e.legalFirstName} ${e.preferredLastName || e.legalLastName}`;
}

export function buildSuggestions(input: SuggestInput): SuggestResult {
  const { rows, matches, now } = input;
  const empById = new Map(input.employees.map((e) => [e.id, e]));
  const deptName = new Map(input.departments.map((d) => [d.id, d.name]));
  const rowByUid = new Map(rows.map((r) => [r.uid, r]));
  const linkKeyByUid = rowLinkKeys(rows);
  const roots = rows.filter((r) => r.managerUid === null);
  const childrenByUid = new Map<string, WorkdayRow[]>();
  for (const r of rows) {
    if (r.managerUid) childrenByUid.set(r.managerUid, [...(childrenByUid.get(r.managerUid) ?? []), r]);
  }

  const linked = new Map<string, number>();
  for (const [uid, m] of matches) if (m.kind === "linked") linked.set(uid, m.employeeId);
  const linkedEmployeeIds = new Set(linked.values());
  const linkedEmp = (uid: string | null | undefined) => {
    const id = uid ? linked.get(uid) : undefined;
    return id === undefined ? undefined : empById.get(id);
  };

  const deptParent = new Map(input.departments.map((d) => [d.id, d.parentDepartmentId]));
  const isAncestor = (ancestorId: number, deptId: number) => {
    const seen = new Set<number>();
    for (let p = deptParent.get(deptId) ?? null; p !== null && !seen.has(p); p = deptParent.get(p) ?? null) {
      if (p === ancestorId) return true;
      seen.add(p);
    }
    return false;
  };

  const lines: Line[] = [];
  const add = (
    line: Omit<Line, "id" | "notes" | "blocked" | "reason" | "current" | "proposed" | "employeeName"> & Partial<Line>,
  ) => {
    const e = line.employeeId !== null ? empById.get(line.employeeId) : undefined;
    lines.push({
      notes: [],
      blocked: null,
      reason: null,
      current: null,
      proposed: null,
      employeeName: e ? displayName(e) : null,
      ...line,
      id: lineId(line.subjectKey, line.field, line.value),
    });
  };
  const toPeople = (candidates: MatchCandidate[]): LinePerson[] =>
    candidates.flatMap((c) => {
      const e = empById.get(c.employeeId);
      return e ? [{ employeeId: e.id, name: displayName(e), reason: c.reason, score: c.score }] : [];
    });

  // Rows Workday doesn't tell apart (same name, manager and title) share a link key, and a link on
  // a shared key is ignored (§13a), so they can't be linked at all.
  const rowsByLinkKey = new Map<string, number>();
  for (const key of linkKeyByUid.values()) rowsByLinkKey.set(key, (rowsByLinkKey.get(key) ?? 0) + 1);
  const unlinkable = (uid: string) => (rowsByLinkKey.get(linkKeyByUid.get(uid)!) ?? 0) > 1;

  /** Why a line that needs this row's employee can't be applied yet. */
  const linkFirst = (r: WorkdayRow): string => {
    const m = matches.get(r.uid);
    if (unlinkable(r.uid)) return `${r.name} can't be linked: Workday lists identical rows for them`;
    if (m?.kind === "notInHrt") return `${r.name} is marked as not in HRT. Undo that link if they are`;
    if (m?.kind === "inactive") return `${r.name} only matches an inactive employee. Rehire them or link someone else first`;
    return `Link ${r.name} first`;
  };

  // ── Rows: identity flags and per-person field lines ─────────────────────────────
  const unlinkableShown = new Set<string>();
  for (const row of rows) {
    const match = matches.get(row.uid);
    const base = { workdayUid: row.uid, workdayName: row.name };

    if (unlinkable(row.uid)) {
      // One line for the whole group: the rows are identical, so so would their lines be.
      const key = linkKeyByUid.get(row.uid)!;
      if (unlinkableShown.has(key)) continue;
      unlinkableShown.add(key);
      add({
        ...base,
        subjectKey: `wd:${key}`,
        field: "notInHrt",
        value: "",
        employeeId: null,
        reason: `Workday lists ${rowsByLinkKey.get(key)} people called ${row.name} with the same manager and title.`,
        blocked: "They can't be linked until Workday tells them apart (e.g. by title).",
        candidates: [],
      });
      continue;
    }

    if (!match || match.kind === "unmatched" || match.kind === "ambiguous" || match.kind === "notInHrt") {
      const confirmed = match?.kind === "notInHrt";
      add({
        ...base,
        subjectKey: `wd:${linkKeyByUid.get(row.uid)}`,
        field: "notInHrt",
        value: "",
        employeeId: null,
        reason: confirmed
          ? "Confirmed as not in HRT. Raise them through the onboarding form."
          : match?.kind === "ambiguous"
            ? "More than one possible match. Link the right employee."
            : "No matching employee in HRT.",
        candidates: match && "candidates" in match ? toPeople(match.candidates) : [],
        confirmedNotInHrt: confirmed,
      });
      continue;
    }

    if (match.kind === "inactive") {
      const e = empById.get(match.employeeId);
      add({
        ...base,
        subjectKey: `wd:${linkKeyByUid.get(row.uid)}`,
        field: "inactiveMatch",
        value: "",
        employeeId: match.employeeId,
        current: e ? `${displayName(e)} (inactive)` : null,
        reason:
          match.via === "link"
            ? "Linked to an employee who is now inactive. Rehire them, or link someone else."
            : "Only matches an inactive employee. Rehire them, or link someone else.",
        candidates: toPeople(match.candidates),
      });
      continue;
    }

    const e = empById.get(match.employeeId);
    if (!e) continue;
    const subjectKey = `emp:${e.id}`;
    const person = { ...base, subjectKey, employeeId: e.id };

    // §7.1 Reports to
    if (row.managerUid === null) {
      // Only when the file has a single top; with several, a root may just be a broken branch.
      if (e.reportsToId !== null && roots.length === 1) {
        add({
          ...person,
          field: "reportsTo",
          value: "none",
          current: nameOf(empById, e.reportsToId),
          proposed: "No manager (top of the tree)",
          change: { kind: "reportsTo", employeeId: e.id, reportsToId: null },
        });
      }
    } else {
      const managerRow = rowByUid.get(row.managerUid);
      const manager = linkedEmp(row.managerUid);
      if (manager && manager.id !== e.reportsToId) {
        add({
          ...person,
          field: "reportsTo",
          value: String(manager.id),
          current: e.reportsToId === null ? "(none)" : nameOf(empById, e.reportsToId),
          proposed: displayName(manager),
          change: { kind: "reportsTo", employeeId: e.id, reportsToId: manager.id },
        });
      } else if (!manager && managerRow) {
        add({
          ...person,
          field: "reportsTo",
          value: `wd:${linkKeyByUid.get(managerRow.uid)}`,
          current: e.reportsToId === null ? "(none)" : nameOf(empById, e.reportsToId),
          proposed: managerRow.name,
          blocked: linkFirst(managerRow),
        });
      }
    }

    // §7.2 Title
    if (row.title && normaliseText(row.title) !== normaliseText(e.title)) {
      add({
        ...person,
        field: "title",
        value: normaliseText(row.title),
        current: e.title || "(none)",
        proposed: row.title,
        change: { kind: "title", employeeId: e.id, title: tidyCase(row.title) },
      });
    }

    // §7.3 Preferred name (never legal)
    const nameLine = preferredNameLine(row, e);
    if (nameLine) add({ ...person, ...nameLine });
  }

  // §7.4 Department: two thirds of same-manager peers share another department.
  for (const row of rows) {
    const e = linkedEmp(row.uid);
    if (!e || !row.managerUid) continue;
    const peers = (childrenByUid.get(row.managerUid) ?? [])
      .filter((p) => p.uid !== row.uid)
      .map((p) => linkedEmp(p.uid))
      .filter((p): p is SuggestEmployee => !!p);
    if (peers.length < 3) continue;
    const [topDept, topCount] = mostCommon(peers.map((p) => p.departmentId));
    if (topDept === undefined || topDept === e.departmentId || topCount * 3 < peers.length * 2) continue;
    // Moving someone up into a parent department (Stores → Operations) is never useful.
    if (isAncestor(topDept, e.departmentId)) continue;
    const managerName = rowByUid.get(row.managerUid)?.name ?? "their manager";
    add({
      subjectKey: `emp:${e.id}`,
      field: "department",
      value: String(topDept),
      employeeId: e.id,
      workdayUid: row.uid,
      workdayName: row.name,
      current: deptName.get(e.departmentId) ?? `#${e.departmentId}`,
      proposed: deptName.get(topDept) ?? `#${topDept}`,
      reason: `${topCount} of ${managerName}'s ${peers.length} other reports are in ${deptName.get(topDept)}.`,
      change: { kind: "department", employeeId: e.id, departmentId: topDept },
    });
  }

  // §8.2 Delegated access
  for (const line of delegatedAccessLines(rows, childrenByUid, linkedEmp, linkFirst, linkKeyByUid, input, deptName)) add(line);

  // ── HRT-side flags ──────────────────────────────────────────────────────────────
  const graceCutoff = new Date(now.getTime() - MISSING_FROM_WORKDAY_GRACE_DAYS * 86_400_000);
  const missing = new Set<number>();
  for (const e of input.employees) {
    if (!e.isActive || deriveEmploymentType(e.status) !== "Internal" || linkedEmployeeIds.has(e.id)) continue;
    if (e.startDate > graceCutoff) continue;
    missing.add(e.id);
    add({
      subjectKey: `emp:${e.id}`,
      field: "missingFromWorkday",
      value: "",
      employeeId: e.id,
      workdayUid: null,
      workdayName: null,
      current: displayName(e),
      reason: "Active internal employee who isn't in this Workday export. Possibly a leaver.",
    });
  }

  for (const e of input.employees) {
    if (!e.isActive || deriveEmploymentType(e.status) !== "External") continue;
    const person = { subjectKey: `emp:${e.id}`, employeeId: e.id, workdayUid: null, workdayName: null };

    // §7.9 External employee whose manager has left
    if (e.reportsToId !== null) {
      const manager = empById.get(e.reportsToId);
      if (!manager?.isActive || missing.has(e.reportsToId)) {
        add({
          ...person,
          field: "externalManagerLeft",
          value: String(e.reportsToId),
          current: nameOf(empById, e.reportsToId),
          reason: manager?.isActive
            ? `Reports to ${displayName(manager)}, who isn't in this Workday export. Reassign their manager by hand.`
            : "Reports to someone who is inactive. Reassign their manager by hand.",
        });
      }
      continue;
    }

    // §7.10 External employee with no reporting line
    const fromOnboarding = input.onboardingManagers.get(e.id);
    const options =
      fromOnboarding !== undefined && empById.get(fromOnboarding)?.isActive && !missing.has(fromOnboarding)
        ? [fromOnboarding]
        : (input.departmentManagers.get(e.departmentId) ?? []).filter(
            (id) => id !== e.id && empById.get(id)?.isActive && !missing.has(id),
          );
    const people = options.map((id) => ({ employeeId: id, name: nameOf(empById, id) }));
    const source = fromOnboarding !== undefined && options[0] === fromOnboarding
      ? "the manager on their onboarding request"
      : `today's managers of ${deptName.get(e.departmentId) ?? "their department"}`;

    if (options.length === 0) {
      add({
        ...person,
        field: "externalReportsTo",
        value: "none",
        current: "(none)",
        reason: "External staff aren't in Workday, so their manager is set in HRT.",
        blocked: "No suggestion. Set their manager by hand on the employee form.",
      });
    } else {
      add({
        ...person,
        field: "externalReportsTo",
        value: options.length === 1 ? String(options[0]) : `pick:${[...options].sort((a, b) => a - b).join(",")}`,
        current: "(none)",
        proposed: options.length === 1 ? people[0].name : `Choose: ${people.map((p) => p.name).join(", ")}`,
        reason: `External staff aren't in Workday. Suggested from ${source}.`,
        options: options.length > 1 ? people : undefined,
        change: { kind: "reportsTo", employeeId: e.id, reportsToId: options.length === 1 ? options[0] : null },
      });
    }
  }

  // §8.3 Grants left behind: the grantee or the manager they act for has gone, or that manager
  // no longer has anyone under them. Grants are never removed automatically; this offers it.
  const activeReports = new Map<number, number>();
  for (const e of input.employees) {
    if (e.isActive && e.reportsToId !== null) activeReports.set(e.reportsToId, (activeReports.get(e.reportsToId) ?? 0) + 1);
  }
  const gone = (id: number) => !empById.get(id)?.isActive || missing.has(id);
  for (const g of input.existingGrants) {
    const grantee = empById.get(g.granteeEmployeeId);
    if (!grantee) continue;
    const scopeName = nameOf(empById, g.scopeManagerEmployeeId);
    let reason: string | null = null;
    if (gone(g.granteeEmployeeId)) {
      reason = grantee.isActive
        ? `${displayName(grantee)} isn't in this Workday export, but still acts at ${scopeName}'s level.`
        : `${displayName(grantee)} is inactive, but still has a grant to act at ${scopeName}'s level.`;
    } else if (gone(g.scopeManagerEmployeeId)) {
      reason = `Acts at ${scopeName}'s level, but ${scopeName} has left. Remove it, and add a grant for whoever now runs that team (a suggestion appears below if one fits).`;
    } else if (!activeReports.get(g.scopeManagerEmployeeId)) {
      reason = `Acts at ${scopeName}'s level, but nobody reports to ${scopeName} any more, so it covers no one.`;
    }
    if (!reason) continue;
    add({
      subjectKey: `emp:${grantee.id}`,
      field: "staleDelegatedAccess",
      // The grant's content, not its id: ids differ between copies of HRT (decision replay).
      value: `${g.scopeManagerEmployeeId}:${g.departmentId ?? ""}`,
      employeeId: grantee.id,
      workdayUid: null,
      workdayName: null,
      current: g.departmentId === null
        ? `Acts at ${scopeName}'s level`
        : `Acts at ${scopeName}'s level, ${deptName.get(g.departmentId) ?? "one department"} only`,
      proposed: "Remove the grant",
      reason,
      change: { kind: "removeDelegatedAccess", grantId: g.id, granteeEmployeeId: grantee.id },
    });
  }

  // ── Ignore rules ────────────────────────────────────────────────────────────────
  const ignored = new Set(input.ignoreRules.map((r) => lineId(r.subjectKey, r.field as LineField, r.value)));
  const visible = lines.filter((l) => !ignored.has(l.id));

  return { lines: visible, ignoredCount: lines.length - visible.length, linkedEmployees: linked };
}

/** §7.3: suggest preferred first/last from Workday's name; never touch legal names. */
function preferredNameLine(row: WorkdayRow, e: SuggestEmployee): Pick<Line, "field" | "value" | "current" | "proposed" | "notes" | "split" | "change"> | null {
  const [first, last] = splitWorkdayName(row.name, [e.preferredLastName, e.legalLastName]);
  const currentFirst = e.preferredFirstName || e.legalFirstName;
  const currentLast = e.preferredLastName || e.legalLastName;
  if (normaliseText(first) === normaliseText(currentFirst) && normaliseText(last) === normaliseText(currentLast)) return null;

  const { preferredFirstName, preferredLastName } = preferredNameChange(e, first, last);

  const notes: LineNote[] = [];
  const before = emailLocalPart(currentFirst, currentLast);
  const after = emailLocalPart(preferredFirstName ?? e.legalFirstName, preferredLastName ?? e.legalLastName);
  if (before !== after) notes.push({ level: "info", text: `Generated email changes from ${before}@ to ${after}@.` });
  const loginLocal = e.userEmail?.split("@")[0]?.toLowerCase();
  if (loginLocal && loginLocal !== after) {
    notes.push({
      level: "warning",
      text: `Login email is ${e.userEmail}, but this name generates ${after}@. Check the account and Snipe for a typo.`,
    });
  }

  return {
    field: "preferredName",
    value: `${normaliseText(first)}|${normaliseText(last)}`,
    current: `${currentFirst} ${currentLast}`,
    proposed: `${preferredFirstName ?? e.legalFirstName} ${preferredLastName ?? e.legalLastName}`,
    notes,
    split: { first, last },
    change: { kind: "preferredName", employeeId: e.id, preferredFirstName, preferredLastName },
  };
}

/** The preferred parts to store for a first/last split. A part equal to the legal part clears the preferred part instead of copying it. */
export function preferredNameChange(
  e: Pick<SuggestEmployee, "legalFirstName" | "legalLastName">,
  first: string,
  last: string,
): { preferredFirstName: string | null; preferredLastName: string | null } {
  return {
    preferredFirstName: normaliseText(first) === normaliseText(e.legalFirstName) ? null : tidyCase(first),
    preferredLastName: normaliseText(last) === normaliseText(e.legalLastName) ? null : tidyCase(last),
  };
}

/** Is `first`/`last` just another split of Workday's `name` (same letters, both parts present)? */
export function isSplitOf(name: string, first: string, last: string): boolean {
  return !!normaliseNameKey(first) && !!normaliseNameKey(last) && normaliseNameKey(`${first}${last}`) === normaliseNameKey(name);
}

/**
 * Split Workday's single Name into first/last. If it ends with one of the employee's
 * surnames, the rest is the first name ("Andrew" + "Staunton Smith"); otherwise first token
 * + the rest.
 */
export function splitWorkdayName(name: string, surnames: (string | null)[]): [string, string] {
  const words = name.trim().split(/\s+/);
  for (const surname of surnames) {
    if (!surname?.trim()) continue;
    const surnameWords = surname.trim().split(/\s+/);
    if (surnameWords.length >= words.length) continue;
    const tail = words.slice(words.length - surnameWords.length);
    if (normaliseText(tail.join(" ")) === normaliseText(surname)) {
      return [words.slice(0, words.length - surnameWords.length).join(" "), tail.join(" ")];
    }
  }
  return [words[0] ?? "", words.slice(1).join(" ")];
}

/** §8.2 Signals A (structure) and B (flat team + title). */
function delegatedAccessLines(
  rows: WorkdayRow[],
  childrenByUid: Map<string, WorkdayRow[]>,
  linkedEmp: (uid: string | null | undefined) => SuggestEmployee | undefined,
  linkFirst: (row: WorkdayRow) => string,
  linkKeyByUid: Map<string, string>,
  input: SuggestInput,
  deptName: Map<number, string>,
): Omit<Line, "id" | "employeeName">[] {
  const out: Omit<Line, "id" | "employeeName">[] = [];
  const roots = new Set(rows.filter((r) => r.managerUid === null).map((r) => r.uid));
  const existing = new Set(
    input.existingGrants.map((g) => `${g.granteeEmployeeId}:${g.scopeManagerEmployeeId}:${g.departmentId ?? ""}`),
  );
  const hasReports = (r: WorkdayRow) => (childrenByUid.get(r.uid)?.length ?? 0) > 0;
  const eligible = (e: SuggestEmployee | undefined): e is SuggestEmployee => !!e && e.isActive && e.userRole !== "Admin";

  const note = input.lineManagerAuthority
    ? "Takes effect as soon as it's applied: line-manager authority is on."
    : "Stored now; it only grants access once line-manager authority is switched on.";
  /** `scopeRow` is the manager acted for; until it's linked the line is shown blocked (§7). */
  const push = (grantee: SuggestEmployee, row: WorkdayRow, scopeRow: WorkdayRow, departmentId: number | null, source: "WorkdayStructural" | "WorkdayTitle", reason: string) => {
    const scope = linkedEmp(scopeRow.uid);
    if (scope && existing.has(`${grantee.id}:${scope.id}:${departmentId ?? ""}`)) return;
    out.push({
      subjectKey: `emp:${grantee.id}`,
      field: "delegatedAccess",
      value: `${scope ? scope.id : `wd:${linkKeyByUid.get(scopeRow.uid)}`}:${departmentId ?? ""}`,
      employeeId: grantee.id,
      workdayUid: row.uid,
      workdayName: row.name,
      current: null,
      proposed: departmentId === null
        ? `Acts at ${scopeRow.name}'s level`
        : `Acts at ${scopeRow.name}'s level, ${deptName.get(departmentId) ?? "their department"} only`,
      reason,
      notes: [{ level: "info", text: note }],
      blocked: scope ? null : linkFirst(scopeRow),
      departmentEditable: scope && source === "WorkdayTitle" ? true : undefined,
      change: scope
        ? { kind: "delegatedAccess", granteeEmployeeId: grantee.id, scopeManagerEmployeeId: scope.id, departmentId, source }
        : undefined,
    });
  };

  for (const managerRow of rows) {
    const team = childrenByUid.get(managerRow.uid) ?? [];
    if (team.length === 0) continue;
    // Suppressed: the root's team and the teams of the root's direct reports. With no root at
    // all (the file is a loop, reported as a tree problem) nothing can be ranked, so nothing is shown.
    if (roots.size === 0 || roots.has(managerRow.uid) || (managerRow.managerUid !== null && roots.has(managerRow.managerUid))) continue;

    const peerManagers = team.filter(hasReports);
    const leaves = team.filter((r) => !hasReports(r));

    // Signal A: a leaf whose peers include a manager acts at that manager's level.
    const small = team.length <= 5 && peerManagers.length < team.length / 2;
    for (const leafRow of leaves) {
      const leaf = linkedEmp(leafRow.uid);
      if (!eligible(leaf)) continue;
      const oversight = OVERSIGHT_WORDS.test(leafRow.title);
      for (const peerRow of peerManagers) {
        const peerTeamDepts = (childrenByUid.get(peerRow.uid) ?? [])
          .map((r) => linkedEmp(r.uid)?.departmentId)
          .filter((d): d is number => d !== undefined);
        const [mainDept] = mostCommon(peerTeamDepts);
        const deptMatches = mainDept !== undefined && mainDept === leaf.departmentId;
        const score = 1 + Number(small) + Number(oversight) + Number(deptMatches);
        if (score < 3) continue;
        const why = [
          `Sits next to ${peerRow.name}, who has reports, and has none of their own`,
          small ? "small team" : null,
          oversight ? `title "${leafRow.title}"` : null,
          deptMatches ? `same department as ${peerRow.name}'s team` : null,
        ].filter(Boolean);
        push(leaf, leafRow, peerRow, null, "WorkdayStructural", `${why.join("; ")}.`);
      }
    }

    // Signal B: in a flat team of 5+, an oversight title acts at their own manager's level.
    if (peerManagers.length === 0 && team.length >= 5) {
      for (const leafRow of leaves) {
        const leaf = linkedEmp(leafRow.uid);
        if (!eligible(leaf) || !OVERSIGHT_WORDS.test(leafRow.title)) continue;
        push(
          leaf,
          leafRow,
          managerRow,
          leaf.departmentId,
          "WorkdayTitle",
          `Title "${leafRow.title}" in ${managerRow.name}'s flat team of ${team.length}. Limited to their own department; change the department here before ticking if that's wrong.`,
        );
      }
    }
  }
  return out;
}

function mostCommon(values: number[]): [number | undefined, number] {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: number | undefined;
  let bestCount = 0;
  for (const [v, c] of counts) if (c > bestCount || (c === bestCount && best !== undefined && v < best)) [best, bestCount] = [v, c];
  return [best, bestCount];
}

function nameOf(empById: Map<number, SuggestEmployee>, id: number): string {
  const e = empById.get(id);
  return e ? displayName(e) : `Employee #${id}`;
}

function emailLocalPart(first: string, last: string): string {
  return `${emailNamePart(first)}.${emailNamePart(last)}`;
}

/** Workday sometimes shouts ("CRAIG WHELAN"); don't write all-caps into HRT. */
function tidyCase(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (trimmed.length > 3 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) {
    return trimmed.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
  }
  return trimmed;
}
