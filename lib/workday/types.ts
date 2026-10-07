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

/** Trimmed, whitespace-collapsed and lower-cased, for "is this really different?" comparisons. */
export function normaliseText(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}
