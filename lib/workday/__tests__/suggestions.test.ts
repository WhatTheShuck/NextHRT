import { describe, it, expect } from "vitest";
import { buildSuggestions, splitWorkdayName, type SuggestEmployee, type SuggestInput } from "../suggestions";
import type { MatchResult } from "../matching";
import { normaliseNameKey, type WorkdayRow } from "../types";

const NOW = new Date("2026-10-07T00:00:00Z");
const LONG_AGO = new Date("2020-01-01T00:00:00Z");

const DEPTS = [
  { id: 1, name: "Service", parentDepartmentId: null },
  { id: 2, name: "Service Coordination", parentDepartmentId: 1 },
  { id: 3, name: "Sales External", parentDepartmentId: null },
  { id: 4, name: "Operations", parentDepartmentId: null },
  { id: 5, name: "Stores", parentDepartmentId: 4 },
  { id: 6, name: "Management", parentDepartmentId: null },
];

function emp(id: number, name: string, overrides: Partial<SuggestEmployee> = {}): SuggestEmployee {
  const [legalFirstName, ...rest] = name.split(" ");
  return {
    id,
    legalFirstName,
    legalLastName: rest.join(" "),
    preferredFirstName: null,
    preferredLastName: null,
    title: "",
    isActive: true,
    status: "Permanent",
    startDate: LONG_AGO,
    departmentId: 1,
    reportsToId: null,
    userEmail: null,
    userRole: null,
    ...overrides,
  };
}

const row = (uid: string, name: string, managerUid: string | null, title = ""): WorkdayRow => ({
  uid,
  name,
  nameKey: normaliseNameKey(name),
  managerUid,
  title,
});

/** Rows plus employees linked one-to-one by uid → id. */
function input(
  rows: WorkdayRow[],
  employees: SuggestEmployee[],
  link: Record<string, number | MatchResult>,
  extra: Partial<SuggestInput> = {},
): SuggestInput {
  const matches = new Map<string, MatchResult>(
    rows.map((r) => {
      const m = link[r.uid];
      if (m === undefined) return [r.uid, { kind: "unmatched", candidates: [] }];
      return [r.uid, typeof m === "number" ? { kind: "linked", employeeId: m, via: "exact" } : m];
    }),
  );
  return {
    rows,
    matches,
    employees,
    departments: DEPTS,
    ignoreRules: [],
    existingGrants: [],
    onboardingManagers: new Map(),
    departmentManagers: new Map(),
    now: NOW,
    ...extra,
  };
}

const fields = <T extends { field: string }>(lines: T[], field: string): T[] => lines.filter((l) => l.field === field);

describe("buildSuggestions: reports to, title, name", () => {
  const rows = [row("r", "Pat Root", null, "Managing Director"), row("a", "Sam Lead", "r", "Service Manager")];

  it("suggests the Workday manager, and clearing a manager for the root", () => {
    const { lines } = buildSuggestions(
      input(rows, [emp(1, "Pat Root", { reportsToId: 2, title: "Managing Director" }), emp(2, "Sam Lead", { title: "Service Manager" })], { r: 1, a: 2 }),
    );
    expect(fields(lines, "reportsTo").map((l) => [l.employeeId, l.change])).toEqual([
      [1, { kind: "reportsTo", employeeId: 1, reportsToId: null }],
      [2, { kind: "reportsTo", employeeId: 2, reportsToId: 1 }],
    ]);
  });

  it("blocks the reports-to line until the manager is linked", () => {
    const { lines } = buildSuggestions(input(rows, [emp(2, "Sam Lead")], { a: 2 }));
    const line = fields(lines, "reportsTo")[0];
    expect(line.blocked).toBe("Link Pat Root first");
    expect(line.change).toBeUndefined();
  });

  it("ignores case and spacing differences in titles", () => {
    const { lines } = buildSuggestions(
      input([row("r", "Pat Root", null, "PROJECT  ENGINEER")], [emp(1, "Pat Root", { title: "Project Engineer" })], { r: 1 }),
    );
    expect(fields(lines, "title")).toEqual([]);
  });

  it("suggests a changed title, without shouting", () => {
    const { lines } = buildSuggestions(
      input([row("r", "Pat Root", null, "SENIOR SERVICE TECHNICIAN")], [emp(1, "Pat Root", { title: "Technician" })], { r: 1 }),
    );
    expect(fields(lines, "title")[0].change).toEqual({ kind: "title", employeeId: 1, title: "Senior Service Technician" });
  });

  it("writes the preferred name only, never the legal name", () => {
    const fred = emp(1, "Frederik Botma", { preferredFirstName: "Frederik" });
    const { lines } = buildSuggestions(input([row("r", "Fred Botma", null)], [fred], { r: 1 }));
    const line = fields(lines, "preferredName")[0];
    expect(line.change).toEqual({ kind: "preferredName", employeeId: 1, preferredFirstName: "Fred", preferredLastName: null });
    expect(line.notes).toEqual([{ level: "info", text: "Generated email changes from frederik.botma@ to fred.botma@." }]);
  });

  it("clears a preferred part that Workday shows as the legal one", () => {
    const hiran = emp(1, "Cecil Doolwela", { preferredFirstName: "Hiran", preferredLastName: "Doolandella" });
    const { lines } = buildSuggestions(input([row("r", "Hiran Doolwela", null)], [hiran], { r: 1 }));
    expect(fields(lines, "preferredName")[0].change).toEqual({
      kind: "preferredName",
      employeeId: 1,
      preferredFirstName: "Hiran",
      preferredLastName: null,
    });
  });

  it("doesn't suggest a name change for case-only differences", () => {
    const { lines } = buildSuggestions(input([row("r", "CRAIG WHELAN", null)], [emp(1, "Craig Whelan")], { r: 1 }));
    expect(fields(lines, "preferredName")).toEqual([]);
  });

  it("warns, without blocking, when the login email doesn't match the new name", () => {
    const hayley = emp(1, "Hayley-Ann Hargrave", { userEmail: "hayleyann.hargrave@example.com" });
    const { lines } = buildSuggestions(input([row("r", "Hayley Hargrave", null)], [hayley], { r: 1 }));
    const line = fields(lines, "preferredName")[0];
    expect(line.blocked).toBeNull();
    expect(line.notes.map((n) => n.level)).toEqual(["info", "warning"]);
  });
});

describe("splitWorkdayName", () => {
  it("keeps multi-word surnames together", () => {
    expect(splitWorkdayName("Andrew Staunton Smith", ["Staunton Smith"])).toEqual(["Andrew", "Staunton Smith"]);
    expect(splitWorkdayName("Muhammad Hilmy Aziz", [null])).toEqual(["Muhammad", "Hilmy Aziz"]);
  });
});

describe("buildSuggestions: department", () => {
  const team = (personDept: number, peerDepts: number[]) => {
    const rows = [row("m", "Tobias Knop", null), row("p", "Cameron Yarrow", "m"), ...peerDepts.map((_, i) => row(`x${i}`, `Peer Number${i}`, "m"))];
    const employees = [emp(1, "Tobias Knop", { departmentId: 6 }), emp(2, "Cameron Yarrow", { departmentId: personDept }), ...peerDepts.map((d, i) => emp(10 + i, `Peer Number${i}`, { departmentId: d }))];
    const link: Record<string, number> = { m: 1, p: 2 };
    peerDepts.forEach((_, i) => (link[`x${i}`] = 10 + i));
    return buildSuggestions(input(rows, employees, link)).lines.filter((l) => l.field === "department" && l.employeeId === 2);
  };

  it("suggests the department two thirds of peers share", () => {
    const [line] = team(2, [3, 3, 1]);
    expect(line.change).toEqual({ kind: "department", employeeId: 2, departmentId: 3 });
    expect(line.reason).toBe("2 of Tobias Knop's 3 other reports are in Sales External.");
  });

  it("needs at least three peers and a two-thirds majority", () => {
    expect(team(2, [3, 3])).toEqual([]);
    expect(team(2, [3, 3, 1, 1])).toEqual([]);
  });

  it("never suggests moving up into a parent department", () => {
    expect(team(5, [4, 4, 4])).toEqual([]); // Stores → Operations
    expect(team(4, [5, 5, 5])).toHaveLength(1); // Operations → Stores is fine
  });
});

describe("buildSuggestions: delegated access", () => {
  // Philippe → Brett → Marcos → { Joshua → techs, Carolyn, Cowen }
  const rows = [
    row("ph", "Philippe Olivier", null),
    row("br", "Brett Lewis", "ph"),
    row("ma", "Marcos Tilly", "br"),
    row("jo", "Joshua Noakes", "ma", "Service Supervisor"),
    row("ca", "Carolyn Molony", "ma", "Service Coordinator"),
    row("t1", "Craig Whelan", "jo", "Trades Assistant"),
    row("t2", "Jarrod Brown", "jo", "Apprentice Tradesperson"),
    row("pa", "Pat Leaf", "br", "Sales Coordinator"),
  ];
  const employees = [
    emp(1, "Philippe Olivier"),
    emp(2, "Brett Lewis"),
    emp(3, "Marcos Tilly"),
    emp(4, "Joshua Noakes", { departmentId: 2 }),
    emp(5, "Carolyn Molony"),
    emp(6, "Craig Whelan"),
    emp(7, "Jarrod Brown"),
    emp(8, "Pat Leaf"),
  ];
  const link = { ph: 1, br: 2, ma: 3, jo: 4, ca: 5, t1: 6, t2: 7, pa: 8 };

  it("suggests a coordinator act at the level of the peer who has reports (Signal A)", () => {
    const lines = fields(buildSuggestions(input(rows, employees, link)).lines, "delegatedAccess");
    expect(lines.map((l) => l.change)).toEqual([
      { kind: "delegatedAccess", granteeEmployeeId: 5, scopeManagerEmployeeId: 4, departmentId: null, source: "WorkdayStructural" },
    ]);
  });

  it("stays quiet near the top of the tree, for admins, and for grants that exist", () => {
    // Pat Leaf sits next to Marcos in Brett's team; Brett reports to the root, so suppressed.
    const asAdmin = employees.map((e) => (e.id === 5 ? { ...e, userRole: "Admin" } : e));
    expect(fields(buildSuggestions(input(rows, asAdmin, link)).lines, "delegatedAccess")).toEqual([]);
    const granted = input(rows, employees, link, {
      existingGrants: [{ granteeEmployeeId: 5, scopeManagerEmployeeId: 4, departmentId: null }],
    });
    expect(fields(buildSuggestions(granted).lines, "delegatedAccess")).toEqual([]);
  });

  it("suggests an oversight title in a flat team, limited to their department (Signal B)", () => {
    const flat = [
      row("ph", "Philippe Olivier", null),
      row("ja", "Jaco Tromp", "ph"),
      row("pe", "Peter Thomas", "ja"),
      ...["Workshop Forman", "Tradesperson", "Tradesperson", "Storeperson", "Document Controller"].map((t, i) => row(`w${i}`, `Worker Person${i}`, "pe", t)),
    ];
    const people = [emp(1, "Philippe Olivier"), emp(2, "Jaco Tromp"), emp(3, "Peter Thomas"), ...[0, 1, 2, 3, 4].map((i) => emp(10 + i, `Worker Person${i}`, { departmentId: 4 }))];
    const flatLink: Record<string, number> = { ph: 1, ja: 2, pe: 3 };
    [0, 1, 2, 3, 4].forEach((i) => (flatLink[`w${i}`] = 10 + i));

    const lines = fields(buildSuggestions(input(flat, people, flatLink)).lines, "delegatedAccess");
    expect(lines.map((l) => l.change)).toEqual([
      { kind: "delegatedAccess", granteeEmployeeId: 10, scopeManagerEmployeeId: 3, departmentId: 4, source: "WorkdayTitle" },
    ]);
  });
});

describe("buildSuggestions: flags and external staff", () => {
  it("flags unmatched and inactive-only rows with their candidates", () => {
    const rows = [row("r", "Pat Root", null), row("n", "New Starter", "r"), row("i", "Troy Phillips", "r")];
    const { lines } = buildSuggestions(
      input(rows, [emp(1, "Pat Root"), emp(2, "Troy Phillips", { isActive: false }), emp(3, "Nu Starter")], {
        r: 1,
        n: { kind: "unmatched", candidates: [{ employeeId: 3, score: 50, reason: "Same surname" }] },
        i: { kind: "inactive", employeeId: 2, via: "exact", candidates: [] },
      }),
    );
    expect(fields(lines, "notInHrt")[0]).toMatchObject({ subjectKey: "wd:newstarter", candidates: [{ employeeId: 3, name: "Nu Starter" }] });
    expect(fields(lines, "inactiveMatch")[0]).toMatchObject({ subjectKey: "wd:troyphillips", employeeId: 2 });
  });

  it("flags internal staff missing from Workday after the grace period, never external staff", () => {
    const { lines } = buildSuggestions(
      input([row("r", "Pat Root", null)], [
        emp(1, "Pat Root"),
        emp(2, "Gone Person"),
        emp(3, "New Person", { startDate: new Date("2026-09-20T00:00:00Z") }),
        emp(4, "Contract Person", { status: "LabourContractor", reportsToId: 1 }),
      ], { r: 1 }),
    );
    expect(fields(lines, "missingFromWorkday").map((l) => l.employeeId)).toEqual([2]);
  });

  it("suggests an external employee's manager from onboarding first, then department managers", () => {
    const employees = [
      emp(1, "Pat Root"),
      emp(2, "Ops Manager", { departmentId: 4 }),
      emp(3, "Gone Manager", { departmentId: 4 }),
      emp(4, "Ebony Hambly", { status: "LabourContractor", departmentId: 4 }),
      emp(5, "Alex Pate", { status: "LabourContractor", departmentId: 4 }),
      emp(6, "Lone Contractor", { status: "LabourContractor", departmentId: 6 }),
    ];
    const rows = [row("r", "Pat Root", null), row("o", "Ops Manager", "r")];
    const { lines } = buildSuggestions(
      input(rows, employees, { r: 1, o: 2 }, {
        onboardingManagers: new Map([[4, 1]]),
        departmentManagers: new Map([[4, [2, 3]]]), // 3 is missing from Workday, so not offered
      }),
    );
    const external = fields(lines, "externalReportsTo");
    expect(external.find((l) => l.employeeId === 4)?.change).toEqual({ kind: "reportsTo", employeeId: 4, reportsToId: 1 });
    expect(external.find((l) => l.employeeId === 5)?.change).toEqual({ kind: "reportsTo", employeeId: 5, reportsToId: 2 });
    expect(external.find((l) => l.employeeId === 6)?.blocked).toMatch(/by hand/);
    expect(external.find((l) => l.employeeId === 6)?.employeeName).toBe("Lone Contractor");
  });

  it("flags an external employee whose manager has left", () => {
    const { lines } = buildSuggestions(
      input([row("r", "Pat Root", null)], [
        emp(1, "Pat Root"),
        emp(2, "Old Boss", { isActive: false }),
        emp(3, "Ebony Hambly", { status: "LabourContractor", reportsToId: 2 }),
      ], { r: 1 }),
    );
    expect(fields(lines, "externalManagerLeft").map((l) => l.employeeId)).toEqual([3]);
  });
});

describe("buildSuggestions: ignore rules", () => {
  it("hides only the exact ignored value", () => {
    const base = input([row("r", "Kerrod Ward", null, "Workshop Forman")], [emp(1, "Kerrod Ward", { title: "Workshop Foreman" })], { r: 1 });
    const ignored = buildSuggestions({ ...base, ignoreRules: [{ subjectKey: "emp:1", field: "title", value: "workshop forman" }] });
    expect(fields(ignored.lines, "title")).toEqual([]);
    expect(ignored.ignoredCount).toBe(1);

    const changed = buildSuggestions({
      ...base,
      rows: [row("r", "Kerrod Ward", null, "Workshop Supervisor")],
      ignoreRules: [{ subjectKey: "emp:1", field: "title", value: "workshop forman" }],
    });
    expect(fields(changed.lines, "title")).toHaveLength(1);
  });
});
