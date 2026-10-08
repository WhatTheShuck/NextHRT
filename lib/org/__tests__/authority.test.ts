import { describe, it, expect } from "vitest";
import {
  approvableBy,
  approversFor,
  buildOrgGraph,
  effectiveRole,
  expiryRecipientsFor,
  lineScope,
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
  { granteeEmployeeId: 10, scopeManagerEmployeeId: 8, departmentId: null }, // Carolyn acts for Joshua
  { granteeEmployeeId: 13, scopeManagerEmployeeId: 12, departmentId: OPS }, // Kerrod acts for Peter, Ops only
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
