import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    employee: { findMany: vi.fn() },
  };
  return { mockPrisma };
});

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import { findNameMatches } from "@/lib/services/employeeDuplicateService";

const START = new Date("2018-01-01T00:00:00.000Z");

/** A candidate row as the first (two-column) scan returns it. */
function candidate(id: number, first: string, last: string) {
  return { id, legalFirstName: first, legalLastName: last };
}

/** A hydrated row as the second (include) query returns it. */
function hydrated(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    legalFirstName: "Jane",
    legalLastName: "Smith",
    preferredFirstName: null,
    preferredLastName: null,
    title: "Fitter",
    department: { id: 2, name: "Maintenance" },
    location: { id: 3, name: "Perth" },
    departmentId: 2,
    locationId: 3,
    status: "Permanent",
    usi: null,
    notes: null,
    jobFamilyId: null,
    isActive: false,
    startDate: START,
    finishDate: new Date("2020-06-30T00:00:00.000Z"),
    ...overrides,
  };
}

/**
 * Wire the two-stage query: the scan returns `candidates`, the hydrate returns
 * whatever rows the filter selected (in the order Prisma would, i.e. as given).
 */
function wire(
  candidates: ReturnType<typeof candidate>[],
  hydratedRows: ReturnType<typeof hydrated>[] = [],
) {
  mockPrisma.employee.findMany
    .mockResolvedValueOnce(candidates)
    .mockResolvedValueOnce(hydratedRows);
}

beforeEach(() => {
  // reset, not clear — `wire()` queues mockResolvedValueOnce values, and
  // vi.clearAllMocks() leaves an unconsumed queue behind for the next test.
  vi.resetAllMocks();
});

describe("findNameMatches", () => {
  it("matches names differing only in case", async () => {
    wire([candidate(5, "Jane", "Smith")], [hydrated(5)]);

    const matches = await findNameMatches("jane", "SMITH");

    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe(5);
  });

  it("trims surrounding whitespace on both sides of the comparison", async () => {
    wire([candidate(5, "  Jane ", "Smith")], [hydrated(5)]);

    const matches = await findNameMatches("Jane\t", " Smith  ");

    expect(matches).toHaveLength(1);
  });

  it("case-folds non-ASCII names — the case a LIKE prefilter would drop", async () => {
    wire(
      [candidate(9, "Müller", "Jose")],
      [hydrated(9, { legalFirstName: "Müller", legalLastName: "Jose" })],
    );

    const matches = await findNameMatches("MÜLLER", "JOSE");

    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe(9);
  });

  it("normalises decomposed and precomposed forms to the same name (NFKC)", async () => {
    const precomposed = "Jos\u00E9"; // as Windows stores it
    const decomposed = "Jose\u0301"; // as macOS types it
    expect(precomposed).not.toBe(decomposed); // different strings, same name

    wire(
      [candidate(11, precomposed, "Silva")],
      [hydrated(11, { legalFirstName: precomposed, legalLastName: "Silva" })],
    );

    const matches = await findNameMatches(decomposed, "Silva");

    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe(11);
  });

  it("does NOT match on accent difference alone (matchingService territory)", async () => {
    wire([candidate(11, "José", "Silva")]);

    expect(await findNameMatches("Jose", "Silva")).toEqual([]);
  });

  it("does not treat % as a wildcard that matches every row", async () => {
    wire([candidate(5, "Jane", "Smith"), candidate(6, "J%ne", "Smith")]);

    // Under LIKE this would return all 399 rows; here it must return none.
    expect(await findNameMatches("%", "_")).toEqual([]);
    expect(mockPrisma.employee.findMany).toHaveBeenCalledTimes(1); // no hydrate
  });

  it("matches % and _ in a stored name literally", async () => {
    wire(
      [candidate(5, "Jane", "Smith"), candidate(6, "J%ne", "Smith_")],
      [hydrated(6, { legalFirstName: "J%ne", legalLastName: "Smith_" })],
    );

    const matches = await findNameMatches("j%ne", "smith_");

    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe(6);
  });

  it("short-circuits on a blank name without querying at all", async () => {
    expect(await findNameMatches("", "Smith")).toEqual([]);
    expect(await findNameMatches("Jane", "   ")).toEqual([]);
    expect(mockPrisma.employee.findMany).not.toHaveBeenCalled();
  });

  it("skips the hydrate query when nothing matched", async () => {
    wire([candidate(5, "Bob", "Jones")]);

    expect(await findNameMatches("Jane", "Smith")).toEqual([]);
    expect(mockPrisma.employee.findMany).toHaveBeenCalledTimes(1);
  });

  it("orders departed records before active ones (finishDate desc, NULLs last)", async () => {
    wire(
      [candidate(5, "Jane", "Smith"), candidate(7, "jane", "smith")],
      [
        hydrated(5, { finishDate: new Date("2020-06-30T00:00:00.000Z") }),
        hydrated(7, { finishDate: null, isActive: true }),
      ],
    );

    const matches = await findNameMatches("Jane", "Smith");

    expect(matches.map((m) => m.id)).toEqual([5, 7]);
    expect(matches[0].isActive).toBe(false);
    expect(matches[1].isActive).toBe(true);
    expect(mockPrisma.employee.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ orderBy: { finishDate: "desc" } }),
    );
  });

  it("projects onto the DuplicateMatch field set with real relations", async () => {
    wire([candidate(5, "Jane", "Smith")], [hydrated(5)]);

    const [match] = await findNameMatches("Jane", "Smith");

    expect(Object.keys(match).sort()).toEqual(
      [
        "department",
        "departmentId",
        "finishDate",
        "id",
        "isActive",
        "jobFamilyId",
        "legalFirstName",
        "legalLastName",
        "location",
        "locationId",
        "notes",
        "preferredFirstName",
        "preferredLastName",
        "startDate",
        "status",
        "title",
        "usi",
      ].sort(),
    );
    // Never the "Unknown" string sentinel that used to sit where a relation belongs.
    expect(match.department).toEqual({ id: 2, name: "Maintenance" });
    expect(match.location).toEqual({ id: 3, name: "Perth" });
  });

  it("runs both reads on the supplied transaction client when given one", async () => {
    const tx = {
      employee: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([candidate(5, "Jane", "Smith")])
          .mockResolvedValueOnce([hydrated(5)]),
      },
    };

    const matches = await findNameMatches("Jane", "Smith", tx as never);

    expect(matches).toHaveLength(1);
    expect(tx.employee.findMany).toHaveBeenCalledTimes(2);
    expect(mockPrisma.employee.findMany).not.toHaveBeenCalled();
  });
});
