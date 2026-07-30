import prisma from "@/lib/prisma";
import {
  Prisma,
  type Department,
  type EmployeeStatus,
  type Location,
} from "@/generated/prisma_client/client";

/**
 * The honest field set carried by a duplicate/rehire match. This is a hand-picked
 * projection, NOT an `Employee` — the reconciliation panels compare
 * typed-vs-existing over exactly these fields and nothing else. Typed here so
 * neither side reaches for relations the payload has never carried.
 */
export interface DuplicateMatch {
  id: number;
  legalFirstName: string;
  legalLastName: string;
  preferredFirstName: string | null;
  preferredLastName: string | null;
  title: string;
  department: Department;
  location: Location;
  departmentId: number;
  locationId: number;
  status: EmployeeStatus;
  usi: string | null;
  notes: string | null;
  jobFamilyId: number | null;
  isActive: boolean;
  startDate: Date;
  finishDate: Date | null;
}

/**
 * Post-JSON shape of `DuplicateMatch` — the two `DateTime` fields arrive as ISO
 * strings. `Department` and `Location` have no date columns, so they cross the
 * wire unchanged.
 */
export type DuplicateMatchWire = Omit<
  DuplicateMatch,
  "startDate" | "finishDate"
> & {
  startDate: string;
  finishDate: string | null;
};

/**
 * Exact-but-case-insensitive name comparison, Unicode-normalised.
 *
 * NFKC matters because "José" typed on macOS (decomposed `e` + combining acute)
 * and "José" stored from Windows (precomposed `é`) are different strings that
 * `toLowerCase()` alone will not reconcile. Accent-*insensitive* matching
 * ("Jose" vs "José") is deliberately out of scope — that is `matchingService`
 * fuzzy territory.
 */
function normaliseName(value: string): string {
  return value.trim().normalize("NFKC").toLowerCase();
}

/**
 * Find employees whose legal names match, case- and Unicode-insensitively.
 *
 * The comparison runs in JS over a two-column scan rather than in SQL, and that
 * is a deliberate call rather than the naive one:
 *
 * - Prisma's `mode: "insensitive"` is a PostgreSQL/MongoDB feature, unavailable
 *   on SQLite, so `equals` here is case-*sensitive* — "jane smith" sails past a
 *   stored "Jane Smith".
 * - A `contains` prefilter does not fix it. It maps to `LIKE`, which folds ASCII
 *   only ('Müller' LIKE '%MÜLLER%' is false), so it would silently drop exactly
 *   the non-ASCII rows the JS filter accepts. SQLite's `lower()` is ASCII-only
 *   too, so there is no SQL-side fix without ICU.
 * - Prisma's `contains` also emits `LIKE ?` with no `ESCAPE` clause, so `%` and
 *   `_` in a name can be neither escaped nor relied upon.
 *
 * `Employee` is a ~400-row HR table in this deployment, so a two-column scan is
 * cheaper than the correctness surface a `LIKE` prefilter costs, and doing it
 * this way deletes the escaping problem, the blank-name wildcard problem and the
 * ASCII-folding hole together rather than adding a guard for each.
 *
 * TABLE-SIZE ASSUMPTION: if this ever runs against a six-figure Employee table,
 * the answer is a normalised generated lowercase column with an index — not
 * `LIKE`.
 *
 * Matches are ordered `finishDate desc`, which puts departed records first and
 * active ones last: SQLite sorts NULLs last under `DESC` and Prisma emits a plain
 * `ORDER BY` with no `NULLS` clause. Callers rely on that ordering, since only
 * departed records are rehire candidates.
 *
 * @param client Optional transaction client — pass the `tx` when the read has to
 *   be inside the caller's transaction (closes the TOCTOU window between
 *   "checked for duplicates" and "created the employee").
 */
export async function findNameMatches(
  firstName: string,
  lastName: string,
  client: Prisma.TransactionClient = prisma,
): Promise<DuplicateMatch[]> {
  const wantedFirst = normaliseName(firstName ?? "");
  const wantedLast = normaliseName(lastName ?? "");

  // A blank name must never match, not even a malformed stored row.
  if (!wantedFirst || !wantedLast) {
    return [];
  }

  const candidates = await client.employee.findMany({
    select: { id: true, legalFirstName: true, legalLastName: true },
  });

  const ids = candidates
    .filter(
      (candidate) =>
        normaliseName(candidate.legalFirstName) === wantedFirst &&
        normaliseName(candidate.legalLastName) === wantedLast,
    )
    .map((candidate) => candidate.id);

  if (ids.length === 0) {
    return [];
  }

  // Hydrate only the matches, with the relations the reconciliation panels need.
  const matches = await client.employee.findMany({
    where: { id: { in: ids } },
    include: { department: true, location: true },
    orderBy: { finishDate: "desc" },
  });

  return matches.map(toDuplicateMatch);
}

/**
 * Project a hydrated employee onto the wire contract. `department` and `location`
 * are required relations on `Employee`, so with the include above they are always
 * present — no "Unknown" string sentinel, which used to put a string where the
 * type promised a relation.
 */
export function toDuplicateMatch(
  employee: Prisma.EmployeeGetPayload<{
    include: { department: true; location: true };
  }>,
): DuplicateMatch {
  return {
    id: employee.id,
    legalFirstName: employee.legalFirstName,
    legalLastName: employee.legalLastName,
    preferredFirstName: employee.preferredFirstName,
    preferredLastName: employee.preferredLastName,
    title: employee.title,
    department: employee.department,
    location: employee.location,
    departmentId: employee.departmentId,
    locationId: employee.locationId,
    status: employee.status,
    usi: employee.usi,
    notes: employee.notes,
    jobFamilyId: employee.jobFamilyId,
    isActive: employee.isActive,
    startDate: employee.startDate,
    finishDate: employee.finishDate,
  };
}

/**
 * The `DUPLICATE_EMPLOYEE` error body as the client receives it. Shared by both
 * clients (the add-form and the dialog it hands off to) so the wire contract lives
 * in one place instead of being re-declared per component.
 */
export interface DuplicateResponse {
  error: string;
  code: string;
  matches: DuplicateMatchWire[];
  suggestions: {
    rehire: boolean;
    duplicate: boolean;
  };
}

/** The `suggestions` half of the `DUPLICATE_EMPLOYEE` throw payload. */
export function duplicateSuggestions(matches: DuplicateMatch[]) {
  return {
    rehire: matches.some((match) => !match.isActive),
    duplicate: true,
  };
}
