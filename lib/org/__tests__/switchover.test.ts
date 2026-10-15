import { describe, it, expect } from "vitest";
import { buildSwitchoverReport, lowestCommonManager, type SwitchoverEmployee } from "../switchover";
import { toManagerMap } from "../reportingLine";

const DEPTS = [
  { id: 2, name: "Operations", level: 0, parentDepartmentId: null },
  { id: 20, name: "Production", level: 1, parentDepartmentId: 2 },
  { id: 21, name: "Stores", level: 1, parentDepartmentId: 2 },
  { id: 33, name: "Service", level: 1, parentDepartmentId: null },
  { id: 6, name: "Management", level: 0, parentDepartmentId: null },
];

const emp = (id: number, name: string, reportsToId: number | null, departmentId: number, extra: Partial<SwitchoverEmployee> = {}): SwitchoverEmployee => ({
  id,
  name,
  reportsToId,
  isActive: true,
  departmentId,
  external: false,
  ...extra,
});

// Philippe → Jaco → Peter → { Kerrod (Operations), Anthony (Production), Brock (Stores) }
// Philippe → Rodrigo → Scott → Elijah (Service)
const tree = [
  emp(1, "Philippe Olivier", null, 6),
  emp(2, "Jaco Tromp", 1, 6),
  emp(3, "Peter Thomas", 2, 2),
  emp(4, "Kerrod Ward", 3, 2),
  emp(5, "Anthony Smith", 3, 20),
  emp(6, "Brock Glasgow", 3, 21),
  emp(7, "Rodrigo Monteiro", 1, 6),
  emp(8, "Scott Hertrick", 7, 33),
  emp(9, "Elijah Dent", 8, 33),
];

const report = (employees = tree, grants: { userId: string; employeeId: number | null; departmentIds: number[] }[] = [], delegated = []) =>
  buildSwitchoverReport({
    employees,
    departments: DEPTS,
    departmentGrants: grants.map((g) => ({ ...g, userName: g.userId })),
    delegatedGrants: delegated,
  });

describe("buildSwitchoverReport", () => {
  it("is ready when everyone has a line and no grants need moving", () => {
    const r = report();
    expect(r.root).toEqual({ id: 1, name: "Philippe Olivier" });
    expect(r.unlined).toEqual([]);
    expect(r.ready).toBe(true);
  });

  it("lists active people with no manager, including those whose manager is inactive", () => {
    const r = report([
      ...tree,
      emp(10, "Ebony Hambly", null, 20, { external: true }),
      emp(11, "Old Boss", null, 2, { isActive: false }),
      emp(12, "Orphan Person", 11, 2),
    ]);
    expect(r.unlined.map((u) => u.name)).toEqual(["Ebony Hambly", "Orphan Person"]);
    expect(r.ready).toBe(false);
  });

  it("drops a grant the reporting line already covers", () => {
    const r = report(tree, [{ userId: "scott", employeeId: 8, departmentIds: [33] }]);
    expect(r.grants[0].outcome).toBe("coveredByLine");
  });

  it("turns an uncovered level-0 grant into one exact-department grant per department it reaches", () => {
    // Kerrod manages Operations (level 0) today, so he reaches Production and Stores too.
    const r = report(tree, [{ userId: "kerrod", employeeId: 4, departmentIds: [2] }]);
    const g = r.grants[0];
    expect(g.coversDepartments).toEqual(["Operations", "Production", "Stores"]);
    expect(g.outcome).toBe("needsGrant");
    expect(g.suggestions.map((s) => [s.departmentName, s.scopeManagerName, s.uncovered])).toEqual([
      ["Operations", "Jaco Tromp", ["Peter Thomas"]], // Peter himself is in Operations, so the scope sits above him
      ["Production", "Peter Thomas", ["Anthony Smith"]],
      ["Stores", "Peter Thomas", ["Brock Glasgow"]],
    ]);
    expect(r.ready).toBe(false);
  });

  it("recognises grants that have already been migrated", () => {
    const r = report(tree, [{ userId: "rod", employeeId: 7, departmentIds: [20] }], [
      { granteeEmployeeId: 7, scopeManagerEmployeeId: 3, departmentId: 20, jobFamilyId: null, level: "Act" },
    ] as never);
    expect(r.grants[0].outcome).toBe("migrated");
  });

  it("doesn't count a View or job-family grant as migrated: neither keeps what a department grant gives", () => {
    for (const g of [
      { granteeEmployeeId: 7, scopeManagerEmployeeId: 3, departmentId: 20, jobFamilyId: null, level: "View" },
      { granteeEmployeeId: 7, scopeManagerEmployeeId: 3, departmentId: 20, jobFamilyId: 5, level: "Act" },
    ]) {
      expect(report(tree, [{ userId: "rod", employeeId: 7, departmentIds: [20] }], [g] as never).grants[0].outcome).toBe("needsGrant");
    }
  });

  it("blocks when someone in the department has no reporting line", () => {
    const r = report([...tree, emp(10, "Ebony Hambly", null, 20, { external: true })], [
      { userId: "kerrod", employeeId: 4, departmentIds: [20] },
    ]);
    expect(r.grants[0].outcome).toBe("blocked");
    expect(r.grants[0].blockedBy).toEqual(["Ebony Hambly"]);
  });

  it("marks grants whose holder has no reporting line themselves", () => {
    const r = report([...tree, emp(14, "Gary Zeidler", null, 33)], [{ userId: "gary", employeeId: 14, departmentIds: [33] }]);
    expect(r.grants[0].holderUnlined).toBe(true);
    expect(r.grants[0].outcome).toBe("needsGrant");
  });

  it("reports grants whose holder can't carry access over", () => {
    const r = report(
      [...tree, emp(13, "Cowen Stokes", 7, 33, { isActive: false })],
      [
        { userId: "dev", employeeId: null, departmentIds: [33] },
        { userId: "cowen", employeeId: 13, departmentIds: [33] },
      ],
    );
    expect(r.grants.map((g) => g.outcome)).toEqual(["noEmployee", "inactive"]);
  });
});

describe("lowestCommonManager", () => {
  const managers = toManagerMap(tree);
  it("finds the nearest manager above everyone", () => {
    expect(lowestCommonManager([5, 6], managers, 1).managerId).toBe(3);
    expect(lowestCommonManager([5, 9], managers, 1).managerId).toBe(1);
    expect(lowestCommonManager([3, 5], managers, 1).managerId).toBe(2); // Peter is in the set, so it's his manager
  });
});
