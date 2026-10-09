/** One person row from a Workday org-chart export (docs/workday-org-import-spec.md §5). */
export interface WorkdayRow {
  /** Workday "Unique Identifier". Renumbered on every export, so only valid within one file. */
  uid: string;
  /** Workday "Name": the person's preferred name. */
  name: string;
  /** `normaliseNameKey(name)`, the identity used for links and ignore rules. */
  nameKey: string;
  /** The manager row's `uid`, or null for the root. */
  managerUid: string | null;
  /** Workday "Line Detail 1". */
  title: string;
}

export type TreeProblemKind =
  | "noRoot"
  | "multipleRoots"
  | "unknownManager"
  | "cycle"
  | "duplicateName";

/** A problem with the shape of the uploaded tree. Reported on the import, never thrown. */
export interface TreeProblem {
  kind: TreeProblemKind;
  message: string;
  uids: string[];
}

export interface ParsedOrgChart {
  rows: WorkdayRow[];
  problems: TreeProblem[];
}

/** Lower-case letters only, accents dropped: "Hayley-Ann  Hargrave" → "hayleyannhargrave". */
export function normaliseNameKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

/**
 * The key each row is remembered by (`WorkdayLink.workdayNameKey`, `wd:` ignore rules): usually
 * its name key. Rows sharing a name are told apart by their manager's name, then their title,
 * since the Unique Identifier is renumbered on every export (§5). Rows that still collide
 * share a key and can't be linked until Workday tells them apart.
 */
export function rowLinkKeys(rows: WorkdayRow[]): Map<string, string> {
  const byUid = new Map(rows.map((r) => [r.uid, r]));
  const count = (keys: string[]) => {
    const counts = new Map<string, number>();
    for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1);
    return counts;
  };
  const nameCount = count(rows.map((r) => r.nameKey));
  const withManager = (r: WorkdayRow) => {
    const manager = r.managerUid ? byUid.get(r.managerUid) : undefined;
    return `${r.nameKey}_${manager ? manager.nameKey : "top"}`;
  };
  const managerCount = count(rows.filter((r) => nameCount.get(r.nameKey)! > 1).map(withManager));

  return new Map(
    rows.map((r) => {
      if (nameCount.get(r.nameKey)! === 1) return [r.uid, r.nameKey];
      const key = withManager(r);
      if (managerCount.get(key)! === 1) return [r.uid, key];
      return [r.uid, `${key}_${normaliseNameKey(r.title) || "notitle"}`];
    }),
  );
}

/** Trimmed, whitespace-collapsed and lower-cased, for "is this really different?" comparisons. */
export function normaliseText(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}
