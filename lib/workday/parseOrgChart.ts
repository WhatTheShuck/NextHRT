import * as XLSX from "xlsx";
import {
  normaliseNameKey,
  type ParsedOrgChart,
  type TreeProblem,
  type WorkdayRow,
} from "./types";

/** The file can't be read as a Workday org chart at all (as opposed to a TreeProblem). */
export class WorkdayParseError extends Error {}

const PREFERRED_SHEET = "Org Chart";

const COLUMNS = {
  uid: "unique identifier",
  name: "name",
  reportsTo: "reports to",
  title: "line detail 1",
} as const;

/**
 * Parse a Workday org-chart export (docs/workday-org-import-spec.md §5). Columns are found by
 * header text, not position. Location ("Line Detail 3") is deliberately not read.
 */
export function parseOrgChart(data: ArrayBuffer | Uint8Array): ParsedOrgChart {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(data, { type: "array" });
  } catch {
    throw new WorkdayParseError("The file couldn't be read as a spreadsheet.");
  }

  const sheetName = workbook.SheetNames.includes(PREFERRED_SHEET)
    ? PREFERRED_SHEET
    : workbook.SheetNames[0];
  if (!sheetName) throw new WorkdayParseError("The spreadsheet has no sheets.");

  const grid = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
    header: 1,
    defval: "",
    blankrows: false,
  });
  if (grid.length === 0) throw new WorkdayParseError(`Sheet "${sheetName}" is empty.`);

  const header = grid[0].map((cell) => String(cell ?? "").trim().toLowerCase());
  const col = (label: string) => header.indexOf(label);
  const idx = {
    uid: col(COLUMNS.uid),
    name: col(COLUMNS.name),
    reportsTo: col(COLUMNS.reportsTo),
    title: col(COLUMNS.title),
  };
  const missing = (["uid", "name", "reportsTo"] as const)
    .filter((key) => idx[key] === -1)
    .map((key) => `"${titleCase(COLUMNS[key])}"`);
  if (missing.length > 0) {
    throw new WorkdayParseError(
      `This doesn't look like a Workday org chart export: missing column${missing.length > 1 ? "s" : ""} ${missing.join(", ")}.`,
    );
  }

  const cell = (row: unknown[], i: number) => (i === -1 ? "" : String(row[i] ?? "").trim());
  const rows: WorkdayRow[] = [];
  for (const raw of grid.slice(1)) {
    const name = cell(raw, idx.name).replace(/\s+/g, " ");
    const uid = cell(raw, idx.uid);
    if (!name && !uid) continue;
    rows.push({
      uid,
      name,
      nameKey: normaliseNameKey(name),
      managerUid: cell(raw, idx.reportsTo) || null,
      title: cell(raw, idx.title).replace(/\s+/g, " "),
    });
  }

  return { rows, problems: validateTree(rows) };
}

/** Exactly one root, every manager resolves, no cycles, no duplicate names (§5). */
export function validateTree(rows: WorkdayRow[]): TreeProblem[] {
  const problems: TreeProblem[] = [];
  const byUid = new Map(rows.map((r) => [r.uid, r]));

  const roots = rows.filter((r) => r.managerUid === null);
  if (roots.length === 0) {
    problems.push({ kind: "noRoot", message: "Nobody is at the top of the tree.", uids: [] });
  } else if (roots.length > 1) {
    problems.push({
      kind: "multipleRoots",
      message: `${roots.length} people have no manager: ${roots.map((r) => r.name).join(", ")}.`,
      uids: roots.map((r) => r.uid),
    });
  }

  for (const row of rows) {
    if (row.managerUid !== null && !byUid.has(row.managerUid)) {
      problems.push({
        kind: "unknownManager",
        message: `${row.name}'s manager "${row.managerUid}" isn't in the file.`,
        uids: [row.uid],
      });
    }
  }

  // Walk up from each row; revisiting a row on the same walk means a loop.
  const reported = new Set<string>();
  for (const row of rows) {
    const path: string[] = [];
    let current: WorkdayRow | undefined = row;
    while (current && !path.includes(current.uid)) {
      path.push(current.uid);
      current = current.managerUid ? byUid.get(current.managerUid) : undefined;
    }
    if (current) {
      const loop = path.slice(path.indexOf(current.uid));
      const key = [...loop].sort().join("|");
      if (!reported.has(key)) {
        reported.add(key);
        problems.push({
          kind: "cycle",
          message: `Reporting loop: ${loop.map((uid) => byUid.get(uid)?.name ?? uid).join(" → ")}.`,
          uids: loop,
        });
      }
    }
  }

  const byKey = new Map<string, WorkdayRow[]>();
  for (const row of rows) byKey.set(row.nameKey, [...(byKey.get(row.nameKey) ?? []), row]);
  for (const same of byKey.values()) {
    if (same.length > 1) {
      problems.push({
        kind: "duplicateName",
        message: `${same.length} people are called "${same[0].name}". They'll need linking by hand.`,
        uids: same.map((r) => r.uid),
      });
    }
  }

  return problems;
}

function titleCase(label: string): string {
  return label.replace(/\b\w/g, (c) => c.toUpperCase());
}
