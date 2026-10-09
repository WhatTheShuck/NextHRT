import { describe, it, expect } from "vitest";
import {
  actScope,
  approvableBy,
  approversFor,
  buildOrgGraph,
  effectiveRole,
  expiryRecipientsFor,
  lineScope,
  describeGrant,
  type Grant,
} from "../authority";

const OPS = 2;
const STORES = 21;
const SERVICE = 33;

// Philippe(1) → Brett(2) → Rodrigo(3) → Scott(4) → Elijah(5), Hayden(6)
//                        → Marcos(7) → Joshua(8) → Craig(9) ; Marcos → Carolyn(10)
// Philippe → Jaco(11) → Peter(12) → Kerrod(13, Ops), Anthony(14, Ops), Brock(15, Stores)
const employees = [
  { id: 1, reportsToId: null, departmentId: 6 },
  { id: 2, reportsToId: 1, departmentId: 6 },
  { id: 3, reportsToId: 2, departmentId: SERVICE },
  { id: 4, reportsToId: 3, departmentId: SERVICE },
  { id: 5, reportsToId: 4, departmentId: SERVICE },
  { id: 6, reportsToId: 4, departmentId: SERVICE },
  { id: 7, reportsToId: 2, departmentId: SERVICE },
  { id: 8, reportsToId: 7, departmentId: SERVICE },
  { id: 9, reportsToId: 8, departmentId: SERVICE },
  { id: 10, reportsToId: 7, departmentId: SERVICE },
  { id: 11, reportsToId: 1, departmentId: OPS },
  { id: 12, reportsToId: 11, departmentId: OPS },
  { id: 13, reportsToId: 12, departmentId: OPS },
  { id: 14, reportsToId: 12, departmentId: OPS },
  { id: 15, reportsToId: 12, departmentId: STORES },
];
const graph = buildOrgGraph(employees);
const grants: Grant[] = [
  { granteeEmployeeId: 10, scopeManagerEmployeeId: 8, departmentId: null, jobFamilyId: null, level: "Act" }, // Carolyn acts for Joshua
  { granteeEmployeeId: 13, scopeManagerEmployeeId: 12, departmentId: OPS, jobFamilyId: null, level: "Act" }, // Kerrod acts for Peter, Ops only
];
const sorted = (s: Iterable<number>) => [...s].sort((a, b) => a - b);

describe("lineScope (viewing: whole sub-tree plus delegated scopes)", () => {
  it("covers everyone below, at any depth", () => {
    expect(sorted(lineScope(3, graph, grants))).toEqual([4, 5, 6]);
    expect(lineScope(1, graph, grants).size).toBe(14);
  });

  it("adds delegated scopes, never the grantee themselves", () => {
    expect(sorted(lineScope(10, graph, grants))).toEqual([9]); // Carolyn sees Joshua's team
    expect(sorted(lineScope(13, graph, grants))).toEqual([14]); // Kerrod: Peter's team ∩ Ops, minus himself; not Brock (Stores)
  });

  it("is empty for someone with no reports and no grants", () => {
    expect(lineScope(9, graph, grants).size).toBe(0);
  });
});

describe("approvals: direct manager plus one level up, delegates count as who they act for", () => {
  it("matches the spec's examples", () => {
    expect(approversFor(5, graph, grants).map((a) => a.employeeId)).toEqual([4, 3]); // Elijah: Scott, Rodrigo. Not Brett.
    expect(approversFor(4, graph, grants).map((a) => a.employeeId)).toEqual([3, 2]); // Scott: Rodrigo, Brett. Not Philippe.
    expect(approversFor(9, graph, grants)).toEqual([
      { employeeId: 8, actingFor: null, relation: "manager" },
      { employeeId: 7, actingFor: null, relation: "oneUp" },
      { employeeId: 10, actingFor: 8, relation: "delegate" }, // Carolyn, on behalf of Joshua
    ]);
    expect(approversFor(14, graph, grants).map((a) => [a.employeeId, a.actingFor])).toEqual([
      [12, null],
      [11, null],
      [13, 12], // Kerrod on behalf of Peter
    ]);
  });

  it("keeps a delegate inside their department filter", () => {
    expect(approversFor(15, graph, grants).map((a) => a.employeeId)).toEqual([12, 11]); // Brock is Stores: no Kerrod
  });

  it("approvableBy is the inverse, and never includes the actor", () => {
    expect(approvableBy(3, graph, grants)).toEqual(new Map([[4, null], [5, null], [6, null]]));
    expect(approvableBy(10, graph, grants)).toEqual(new Map([[9, 8]]));
    expect(approvableBy(13, graph, grants)).toEqual(new Map([[14, 12]])); // not himself, not Brock
    expect(approvableBy(1, graph, grants).has(5)).toBe(false); // Philippe is too far up for Elijah
  });

  it("has nobody for someone without a manager", () => {
    expect(approversFor(1, graph, grants)).toEqual([]);
  });
});

describe("expiryRecipientsFor", () => {
  it("is the direct manager plus delegates at that level, nobody higher", () => {
    expect(expiryRecipientsFor(9, graph, grants)).toEqual([8, 10]); // Joshua and Carolyn
    expect(expiryRecipientsFor(5, graph, grants)).toEqual([4]); // Scott only
  });
});

describe("View grants and job-family filters", () => {
  const STOREPERSON = 7;
  const withFamilies = buildOrgGraph(employees.map((e) => ({ ...e, jobFamilyId: e.id === 15 ? STOREPERSON : null })));
  const viewGrants: Grant[] = [
    ...grants,
    { granteeEmployeeId: 4, scopeManagerEmployeeId: 7, departmentId: null, jobFamilyId: null, level: "View" }, // Scott sees Marcos's team
    { granteeEmployeeId: 14, scopeManagerEmployeeId: 12, departmentId: null, jobFamilyId: STOREPERSON, level: "View" }, // Anthony sees Peter's storepeople
  ];

  it("adds the scope to what the grantee sees", () => {
    expect(sorted(lineScope(4, withFamilies, viewGrants))).toEqual([5, 6, 8, 9, 10]);
    expect(sorted(lineScope(14, withFamilies, viewGrants))).toEqual([15]);
  });

  it("never approves or gets expiry emails", () => {
    expect(approvableBy(4, withFamilies, viewGrants).has(9)).toBe(false);
    expect(approversFor(9, withFamilies, viewGrants).map((a) => a.employeeId)).not.toContain(4);
    expect(expiryRecipientsFor(15, withFamilies, viewGrants)).toEqual([12]);
  });

  it("narrows by job family, and by department and job family together", () => {
    const both: Grant = { granteeEmployeeId: 14, scopeManagerEmployeeId: 12, departmentId: OPS, jobFamilyId: STOREPERSON, level: "View" };
    expect(lineScope(14, withFamilies, [both]).size).toBe(0); // the storeperson is in Stores, not Ops
  });
});

describe("buildOrgGraph", () => {
  it("treats a report of an inactive manager as having no manager", () => {
    const g = buildOrgGraph([{ id: 1, reportsToId: 99, departmentId: 1 }]);
    expect(g.managers.get(1)).toBeNull();
  });
});

describe("effectiveRole", () => {
  it("changes nothing in department mode", () => {
    expect(effectiveRole("DepartmentManager", "department", false)).toBe("DepartmentManager");
    expect(effectiveRole("User", "department", true)).toBe("User");
  });

  it("derives manager permissions from scope in line-manager mode", () => {
    expect(effectiveRole("User", "lineManager", true)).toBe("DepartmentManager");
    expect(effectiveRole("FireWarden", "lineManager", true)).toBe("FireWarden,DepartmentManager");
    expect(effectiveRole("DepartmentManager", "lineManager", false)).toBe("User");
    expect(effectiveRole("FireWarden", "lineManager", false)).toBe("FireWarden");
    expect(effectiveRole("Admin", "lineManager", false)).toBe("Admin");
    expect(effectiveRole(null, "lineManager", false)).toBe("User");
  });
});

describe("describeGrant", () => {
  it("says what the grant does and how it's narrowed", () => {
    expect(describeGrant({ level: "Act", scopeName: "Joshua Noakes" })).toBe("Acts at Joshua Noakes's level");
    expect(describeGrant({ level: "View", scopeName: "Peter Thomas", jobFamilyName: "Storeperson" })).toBe(
      "Sees Peter Thomas's team, Storeperson only",
    );
    expect(describeGrant({ level: "View", scopeName: "Jaco Tromp", departmentName: "Production", jobFamilyName: "Tradesperson" })).toBe(
      "Sees Jaco Tromp's team, Production / Tradesperson only",
    );
  });
});

describe("actScope (submitting on someone's behalf)", () => {
  const withView: Grant[] = [
    ...grants,
    { granteeEmployeeId: 9, scopeManagerEmployeeId: 3, departmentId: null, jobFamilyId: null, level: "View" }, // Craig only views Rodrigo's team
  ];

  it("covers the whole sub-tree, not just two levels (skip-level managers can act)", () => {
    expect(actScope(1, graph, withView).has(5)).toBe(true); // Philippe → … → Elijah, four levels down
    expect(sorted(actScope(2, graph, withView))).toEqual([3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("includes Act grants", () => {
    expect(sorted(actScope(10, graph, withView))).toEqual([9]); // Carolyn acts for Joshua
  });

  it("excludes View grants", () => {
    expect(lineScope(9, graph, withView).has(4)).toBe(true); // can see
    expect(actScope(9, graph, withView).size).toBe(0); // cannot act
  });
});
