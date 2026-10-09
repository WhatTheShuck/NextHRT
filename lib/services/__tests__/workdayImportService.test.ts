import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    workdayImport: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    employee: { findMany: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
    department: { findMany: vi.fn() },
    workdayLink: { findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
    workdayIgnoreRule: { findMany: vi.fn(), upsert: vi.fn() },
    delegatedAccess: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
    onboardingRequest: { findMany: vi.fn() },
    user: { findMany: vi.fn() },
    history: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  return { mockPrisma };
});

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));
vi.mock("@/lib/services/authorityService", () => ({ getAuthorityMode: vi.fn().mockResolvedValue("department") }));
vi.mock("@/lib/services/requirementService", () => ({ requirementService: { getEmployeeRequirements: vi.fn() } }));
vi.mock("@/lib/services/employeeRehire", () => ({ enqueueRequirementsCacheInvalidate: vi.fn() }));

import {
  ApplyCycleError,
  createGrantInTx,
  ReplayMismatchError,
  workdayImportService,
} from "@/lib/services/workdayImportService";
import { DECISION_BUNDLE_FORMAT, type DecisionBundle } from "@/lib/workday/decisionBundle";
import { normaliseNameKey, type WorkdayRow } from "@/lib/workday/types";

const LONG_AGO = new Date("2020-01-01T00:00:00Z");

function emp(id: number, name: string, overrides: Record<string, unknown> = {}) {
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
    locationId: 1,
    reportsToId: null,
    location: { name: "Bundamba" },
    User: null,
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

/** An open session of `rows` against `employees`, with runs kept in memory. */
function setup(rows: WorkdayRow[], employees: ReturnType<typeof emp>[], deptManagers: { employeeId: number; managedDepartments: { id: number }[] }[] = []) {
  let runs = "[]";
  mockPrisma.workdayImport.findUnique.mockImplementation(async () => ({ id: 7, status: "Open", rows: JSON.stringify(rows), runs }));
  mockPrisma.workdayImport.update.mockImplementation(async ({ data }: { data: { runs: string } }) => {
    runs = data.runs;
  });
  mockPrisma.workdayImport.findUniqueOrThrow.mockImplementation(async () => ({ runs }));
  mockPrisma.employee.findMany.mockResolvedValue(employees);
  mockPrisma.employee.findUniqueOrThrow.mockImplementation(async ({ where }: { where: { id: number } }) =>
    employees.find((e) => e.id === where.id),
  );
  mockPrisma.department.findMany.mockResolvedValue([{ id: 1, name: "Service", parentDepartmentId: null }]);
  mockPrisma.workdayLink.findMany.mockResolvedValue([]);
  mockPrisma.workdayIgnoreRule.findMany.mockResolvedValue([]);
  mockPrisma.delegatedAccess.findMany.mockResolvedValue([]);
  mockPrisma.onboardingRequest.findMany.mockResolvedValue([]);
  mockPrisma.user.findMany.mockResolvedValue(deptManagers);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) => fn(mockPrisma));
});

describe("workdayImportService.apply", () => {
  const rows = [row("r", "Pat Root", null), row("a", "Sam Lead", "r", "Service Manager")];

  it("applies ticked lines with one History row per person, and reports stale ones", async () => {
    setup(rows, [emp(1, "Pat Root"), emp(2, "Sam Lead", { title: "Technician" })]);

    const run = await workdayImportService.apply(
      7,
      { ticked: ["emp:2~reportsTo~1", "emp:2~title~service manager", "emp:2~title~something old"], crossed: ["emp:9~title~x"] },
      "u1",
    );

    expect(mockPrisma.employee.update).toHaveBeenCalledTimes(1);
    expect(mockPrisma.employee.update).toHaveBeenCalledWith({ where: { id: 2 }, data: { title: "Service Manager", reportsToId: 1 } });
    expect(mockPrisma.history.create).toHaveBeenCalledTimes(1);
    const history = mockPrisma.history.create.mock.calls[0][0].data;
    expect(JSON.parse(history.changedFields)).toEqual(["title", "reportsToId"]);
    expect(JSON.parse(history.newValues).source).toBe("WorkdayImport#7");
    expect(run.applied.map((a) => a.lineId)).toEqual(["emp:2~title~service manager", "emp:2~reportsTo~1"]);
    expect(run.stale).toEqual(["emp:2~title~something old"]);
    expect(run.crossed).toEqual(["emp:9~title~x"]);
  });

  it("rolls the whole apply back when it would create a reporting loop", async () => {
    // HRT has Pat reporting to Sam; ticking only "Sam reports to Pat" closes a loop.
    setup(rows, [emp(1, "Pat Root", { reportsToId: 2 }), emp(2, "Sam Lead", { title: "Service Manager" })]);

    const result = workdayImportService.apply(7, { ticked: ["emp:2~reportsTo~1"], crossed: [] }, "u1");

    await expect(result).rejects.toBeInstanceOf(ApplyCycleError);
    expect(mockPrisma.employee.update).not.toHaveBeenCalled();
    expect(mockPrisma.workdayImport.update).not.toHaveBeenCalled();
  });

  it("needs a valid manager choice on a line with several options", async () => {
    const employees = [emp(1, "Pat Root"), emp(2, "Sam Lead", { title: "Service Manager", reportsToId: 1 }), emp(3, "Alex Apprentice", { status: "Apprentice" })];
    const deptManagers = [
      { employeeId: 1, managedDepartments: [{ id: 1 }] },
      { employeeId: 2, managedDepartments: [{ id: 1 }] },
    ];
    const lineId = "emp:3~externalReportsTo~pick:1,2";

    setup(rows, employees, deptManagers);
    for (const choices of [undefined, { [lineId]: 99 }]) {
      const run = await workdayImportService.apply(7, { ticked: [lineId], crossed: [], choices }, "u1");
      expect(run.stale).toEqual([lineId]);
    }
    expect(mockPrisma.employee.update).not.toHaveBeenCalled();

    const run = await workdayImportService.apply(7, { ticked: [lineId], crossed: [], choices: { [lineId]: 2 } }, "u1");
    expect(mockPrisma.employee.update).toHaveBeenCalledWith({ where: { id: 3 }, data: { reportsToId: 2 } });
    expect(run.applied[0]).toMatchObject({ lineId, choice: 2 });
  });

  it("only accepts an edited name split that is the same Workday name re-divided", async () => {
    setup([row("r", "Fred Van Botma", null)], [emp(1, "Frederik Botma")]);
    mockPrisma.workdayLink.findMany.mockResolvedValue([{ workdayNameKey: "fredvanbotma", employeeId: 1 }]);
    const lineId = "emp:1~preferredName~fred van|botma";

    const refused = await workdayImportService.apply(7, { ticked: [lineId], crossed: [], names: { [lineId]: { first: "Freddy", last: "Botma" } } }, "u1");
    expect(refused.stale).toEqual([lineId]);

    await workdayImportService.apply(7, { ticked: [lineId], crossed: [], names: { [lineId]: { first: "Fred", last: "Van Botma" } } }, "u1");
    expect(mockPrisma.employee.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { preferredFirstName: "Fred", preferredLastName: "Van Botma" },
    });
  });
});

describe("createGrantInTx", () => {
  const grant = { granteeEmployeeId: 5, scopeManagerEmployeeId: 4, departmentId: null, source: "Manual", createdByUserId: "u1" };

  it("skips an identical unfiltered grant (NULLs aren't unique in SQLite)", async () => {
    mockPrisma.delegatedAccess.findFirst.mockResolvedValue({ id: 1, ...grant });
    expect(await createGrantInTx(mockPrisma as never, grant)).toBeNull();
    expect(mockPrisma.delegatedAccess.create).not.toHaveBeenCalled();
  });

  it("creates the grant with a History row", async () => {
    mockPrisma.delegatedAccess.findFirst.mockResolvedValue(null);
    mockPrisma.delegatedAccess.create.mockResolvedValue({ id: 9, ...grant });
    await createGrantInTx(mockPrisma as never, grant);
    expect(mockPrisma.history.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tableName: "DelegatedAccess", recordId: "9", action: "CREATE" }),
    });
  });
});

describe("workdayImportService.replayDecisions", () => {
  it("changes nothing when the target isn't a copy of the source", async () => {
    mockPrisma.employee.findMany.mockResolvedValue([{ id: 1, legalFirstName: "Someone", legalLastName: "Else" }]);
    mockPrisma.department.findMany.mockResolvedValue([]);

    const bundle: DecisionBundle = {
      format: DECISION_BUNDLE_FORMAT,
      version: 1,
      exportedAt: "2026-10-07T00:00:00Z",
      employees: { "1": "Pat Root" },
      departments: {},
      links: [{ workdayNameKey: "patroot", workdayName: "Pat Root", employeeId: 1 }],
      ignoreRules: [],
      grants: [],
      sessions: [],
    };

    await expect(workdayImportService.replayDecisions(bundle, "u1")).rejects.toBeInstanceOf(ReplayMismatchError);
    expect(mockPrisma.workdayLink.upsert).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("workdayImportService.isLinkableKey", () => {
  it("refuses a key that several rows in the open session share", async () => {
    const twins = [row("r", "Pat Root", null), row("a1", "Ann Lee", "r", "Clerk"), row("a2", "Ann Lee", "r", "Clerk")];
    mockPrisma.workdayImport.findMany.mockResolvedValue([{ rows: JSON.stringify(twins) }]);
    expect(await workdayImportService.isLinkableKey("annlee_patroot_clerk")).toBe(false);
    expect(await workdayImportService.isLinkableKey("patroot")).toBe(true);
  });
});
