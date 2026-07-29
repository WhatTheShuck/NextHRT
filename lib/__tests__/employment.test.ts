import { describe, it, expect } from "vitest";
import {
  serializePriorStint,
  parsePriorStints,
  type PriorStint,
} from "@/lib/employment";

function makeEmployee(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    title: "Fitter",
    startDate: new Date("2020-01-01T00:00:00.000Z"),
    finishDate: new Date("2022-06-30T00:00:00.000Z"),
    status: "Permanent",
    department: { name: "Maintenance" },
    location: { name: "Perth" },
    ...overrides,
  };
}

describe("serializePriorStint", () => {
  it("reads names from the loaded department/location relations", () => {
    const stint = serializePriorStint(makeEmployee(), null);
    expect(stint).toEqual({
      startDate: "2020-01-01T00:00:00.000Z",
      finishDate: "2022-06-30T00:00:00.000Z",
      title: "Fitter",
      departmentName: "Maintenance",
      locationName: "Perth",
      status: "Permanent",
    });
  });

  it("uses the supplied priorFinishDate when employee.finishDate is null", () => {
    const stint = serializePriorStint(
      makeEmployee({ finishDate: null }),
      "2023-03-15T00:00:00.000Z",
    );
    expect(stint.finishDate).toBe("2023-03-15T00:00:00.000Z");
  });
});

describe("parsePriorStints", () => {
  it("round-trips a serialized stint", () => {
    const emp = makeEmployee();
    const rows = [{ oldValues: JSON.stringify(serializePriorStint(emp, null)) }];
    const stints = parsePriorStints(rows);
    expect(stints).toHaveLength(1);
    expect(stints[0]).toEqual<PriorStint>({
      startDate: "2020-01-01T00:00:00.000Z",
      finishDate: "2022-06-30T00:00:00.000Z",
      title: "Fitter",
      departmentName: "Maintenance",
      locationName: "Perth",
      status: "Permanent",
    });
  });

  it("preserves the caller-provided (newest-first) order", () => {
    const newer = serializePriorStint(
      makeEmployee({ title: "Senior Fitter" }),
      null,
    );
    const older = serializePriorStint(makeEmployee({ title: "Fitter" }), null);
    const rows = [
      { oldValues: JSON.stringify(newer) },
      { oldValues: JSON.stringify(older) },
    ];
    const stints = parsePriorStints(rows);
    expect(stints.map((s) => s.title)).toEqual(["Senior Fitter", "Fitter"]);
  });

  it("skips rows with unparseable oldValues instead of throwing", () => {
    const good = serializePriorStint(makeEmployee(), null);
    const rows = [
      { oldValues: "{ not json" },
      { oldValues: null },
      { oldValues: JSON.stringify(good) },
    ];
    const stints = parsePriorStints(rows);
    expect(stints).toHaveLength(1);
    expect(stints[0].title).toBe("Fitter");
  });
});
