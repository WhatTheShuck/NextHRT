import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, mockEnqueue } = vi.hoisted(() => {
  const mockPrisma = {
    employee: { findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn(), create: vi.fn() },
    history: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  return { mockPrisma, mockEnqueue: vi.fn() };
});

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));
vi.mock("@/lib/auth", () => ({ auth: { api: { userHasPermission: vi.fn() } } }));
vi.mock("@/lib/apiRBAC", () => ({ getChildDepartmentIds: vi.fn() }));
vi.mock("@/lib/jobs/jobQueue", () => ({ enqueue: mockEnqueue }));

import { employeeService } from "@/lib/services/employeeService";

const PRIOR_START = new Date("2018-01-01T00:00:00.000Z");
const PRIOR_FINISH = new Date("2020-06-30T00:00:00.000Z");

function makeExisting(overrides: Record<string, unknown> = {}) {
  return {
    id: 5,
    legalFirstName: "Jane",
    legalLastName: "Smith",
    preferredFirstName: "Jane",
    preferredLastName: "Smith",
    title: "Fitter",
    startDate: PRIOR_START,
    finishDate: PRIOR_FINISH,
    status: "Permanent",
    isActive: false,
    hasPriorEmployment: false,
    usi: "OLD-USI",
    notes: "old notes",
    departmentId: 2,
    locationId: 3,
    department: { id: 2, name: "Maintenance" },
    location: { id: 3, name: "Perth" },
    ...overrides,
  };
}

function makeData(overrides: Record<string, unknown> = {}) {
  return {
    startDate: "2024-01-15T00:00:00.000Z",
    title: "Senior Fitter",
    departmentId: 7,
    locationId: 8,
    status: "LabourContractor",
    jobFamilyId: 4,
    usi: "NEW-USI",
    notes: "new notes",
    preferredFirstName: "Janey",
    preferredLastName: "Smith",
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mockPrisma.$transaction.mockImplementation(async (arg: unknown) => {
    if (typeof arg === "function") return (arg as (tx: unknown) => unknown)(mockPrisma);
    return Promise.all(arg as Promise<unknown>[]);
  });
  mockPrisma.employee.update.mockResolvedValue({ id: 5 });
  mockPrisma.history.create.mockResolvedValue({});
});

describe("employeeService.rehireEmployee", () => {
  it("archives the prior stint as a REHIRE history row with snapshotted names", async () => {
    mockPrisma.employee.findUnique.mockResolvedValue(makeExisting());

    await employeeService.rehireEmployee(5, makeData(), "user1");

    expect(mockPrisma.history.create).toHaveBeenCalledTimes(1);
    const arg = mockPrisma.history.create.mock.calls[0][0].data;
    expect(arg.action).toBe("REHIRE");
    expect(arg.tableName).toBe("Employee");
    expect(arg.recordId).toBe("5");
    expect(arg.userId).toBe("user1");

    const oldStint = JSON.parse(arg.oldValues);
    expect(Object.keys(oldStint).sort()).toEqual(
      ["departmentName", "finishDate", "locationName", "startDate", "status", "title"],
    );
    expect(oldStint.departmentName).toBe("Maintenance");
    expect(oldStint.locationName).toBe("Perth");
    expect(oldStint.title).toBe("Fitter");
    expect(oldStint.finishDate).toBe(PRIOR_FINISH.toISOString());

    const newStint = JSON.parse(arg.newValues);
    expect(newStint.title).toBe("Senior Fitter");
    expect(newStint.startDate).toBe("2024-01-15T00:00:00.000Z");

    // changedFields = full prior-record snapshot for audit backup
    const changed = JSON.parse(arg.changedFields);
    expect(changed.id).toBe(5);
    expect(changed.usi).toBe("OLD-USI");
  });

  it("updates the live record: reactivates, clears finish, re-derives type", async () => {
    mockPrisma.employee.findUnique.mockResolvedValue(makeExisting());

    await employeeService.rehireEmployee(5, makeData(), "user1");

    expect(mockPrisma.employee.update).toHaveBeenCalledTimes(1);
    const data = mockPrisma.employee.update.mock.calls[0][0].data;
    expect(data.startDate).toEqual(new Date("2024-01-15T00:00:00.000Z"));
    expect(data.finishDate).toBeNull();
    expect(data.isActive).toBe(true);
    expect(data.hasPriorEmployment).toBe(true);
    // LabourContractor derives to External
    expect(data.employmentType).toBe("External");
  });

  it("applies the reconciled values verbatim", async () => {
    mockPrisma.employee.findUnique.mockResolvedValue(makeExisting());

    await employeeService.rehireEmployee(5, makeData(), "user1");

    const data = mockPrisma.employee.update.mock.calls[0][0].data;
    expect(data.title).toBe("Senior Fitter");
    expect(data.status).toBe("LabourContractor");
    expect(data.usi).toBe("NEW-USI");
    expect(data.notes).toBe("new notes");
    expect(data.preferredFirstName).toBe("Janey");
    expect(data.department).toEqual({ connect: { id: 7 } });
    expect(data.location).toEqual({ connect: { id: 8 } });
    expect(data.jobFamily).toEqual({ connect: { id: 4 } });
  });

  it("rejects rehiring an already-active employee", async () => {
    mockPrisma.employee.findUnique.mockResolvedValue(makeExisting({ isActive: true }));

    await expect(
      employeeService.rehireEmployee(5, makeData(), "user1"),
    ).rejects.toThrow("ACTIVE_EMPLOYEE");
    expect(mockPrisma.employee.update).not.toHaveBeenCalled();
  });

  it("requires a prior finish date when the record's finishDate is null", async () => {
    mockPrisma.employee.findUnique.mockResolvedValue(
      makeExisting({ finishDate: null }),
    );

    await expect(
      employeeService.rehireEmployee(5, makeData({ priorFinishDate: undefined }), "user1"),
    ).rejects.toThrow("MISSING_FINISH_DATE");
  });

  it("uses the supplied priorFinishDate when the record's finishDate is null", async () => {
    mockPrisma.employee.findUnique.mockResolvedValue(
      makeExisting({ finishDate: null }),
    );

    await employeeService.rehireEmployee(
      5,
      makeData({ priorFinishDate: "2023-01-01T00:00:00.000Z" }),
      "user1",
    );

    const oldStint = JSON.parse(mockPrisma.history.create.mock.calls[0][0].data.oldValues);
    expect(oldStint.finishDate).toBe("2023-01-01T00:00:00.000Z");
  });

  it("rejects a rehire start on or before the prior finish date", async () => {
    mockPrisma.employee.findUnique.mockResolvedValue(makeExisting());

    await expect(
      employeeService.rehireEmployee(
        5,
        makeData({ startDate: "2020-06-30T00:00:00.000Z" }),
        "user1",
      ),
    ).rejects.toThrow("INVALID_REHIRE_DATE");
    expect(mockPrisma.employee.update).not.toHaveBeenCalled();
  });

  it("throws EMPLOYEE_NOT_FOUND when the employee does not exist", async () => {
    mockPrisma.employee.findUnique.mockResolvedValue(null);

    await expect(
      employeeService.rehireEmployee(5, makeData(), "user1"),
    ).rejects.toThrow("EMPLOYEE_NOT_FOUND");
  });
});

describe("employeeService.createEmployee duplicate detection", () => {
  const createData = {
    legalFirstName: "jane",
    legalLastName: "SMITH",
    title: "Fitter",
    startDate: "2026-01-05T00:00:00.000Z",
    departmentId: 2,
    locationId: 3,
  };

  /** Wire employeeDuplicateService's two-stage read: scan, then hydrate. */
  function wireMatch() {
    mockPrisma.employee.findMany
      .mockResolvedValueOnce([
        { id: 5, legalFirstName: "Jane", legalLastName: "Smith" },
      ])
      .mockResolvedValueOnce([makeExisting()]);
  }

  it("throws DUPLICATE_EMPLOYEE for a name differing only in case", async () => {
    wireMatch();

    // The payoff of routing createEmployee through employeeDuplicateService:
    // before, `equals` on SQLite let "jane smith" past a stored "Jane Smith".
    await expect(
      employeeService.createEmployee(createData, "user1"),
    ).rejects.toMatchObject({ code: "DUPLICATE_EMPLOYEE" });
    expect(mockPrisma.employee.create).not.toHaveBeenCalled();
  });

  it("carries the throw shape employee-add-form.tsx reads", async () => {
    wireMatch();

    let thrown: Record<string, any> = {};
    try {
      await employeeService.createEmployee(createData, "user1");
    } catch (e) {
      thrown = e as Record<string, any>;
    }

    expect(thrown.code).toBe("DUPLICATE_EMPLOYEE");
    expect(thrown.suggestions).toEqual({ rehire: true, duplicate: true });
    expect(thrown.matches).toHaveLength(1);
    expect(thrown.matches[0]).toMatchObject({
      id: 5,
      legalFirstName: "Jane",
      legalLastName: "Smith",
      isActive: false,
    });
    // department is the relation object, never the "Unknown" string sentinel.
    expect(thrown.matches[0].department).toEqual({ id: 2, name: "Maintenance" });
  });

  it("skips the check entirely when confirmDuplicate is set", async () => {
    mockPrisma.employee.create.mockResolvedValue({ id: 9 });

    await employeeService.createEmployee(
      { ...createData, confirmDuplicate: true },
      "user1",
    );

    expect(mockPrisma.employee.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.employee.create).toHaveBeenCalledTimes(1);
  });

  it("creates the employee when no name matches", async () => {
    mockPrisma.employee.findMany.mockResolvedValueOnce([
      { id: 7, legalFirstName: "Bob", legalLastName: "Jones" },
    ]);
    mockPrisma.employee.create.mockResolvedValue({ id: 9 });

    await employeeService.createEmployee(createData, "user1");

    expect(mockPrisma.employee.create).toHaveBeenCalledTimes(1);
  });
});

describe("requirements cache invalidation", () => {
  it("enqueues an invalidate for the rehired employee after the transaction commits", async () => {
    mockPrisma.employee.findUnique.mockResolvedValue(makeExisting());

    await employeeService.rehireEmployee(5, makeData(), "user1");

    expect(mockEnqueue).toHaveBeenCalledWith("REQUIREMENTS_CACHE_INVALIDATE", {
      employeeId: 5,
    });
    // A reactivated employee keeps the cache rows from their old stint, computed
    // against the old dept/location; the nightly rebuild skips inactive rows so
    // nothing else ever clears them.
    const enqueueOrder = mockEnqueue.mock.invocationCallOrder[0];
    const updateOrder = mockPrisma.employee.update.mock.invocationCallOrder[0];
    expect(enqueueOrder).toBeGreaterThan(updateOrder);
  });

  it("does not let an enqueue failure fail the committed rehire", async () => {
    mockPrisma.employee.findUnique.mockResolvedValue(makeExisting());
    mockEnqueue.mockRejectedValueOnce(new Error("queue down"));

    await expect(
      employeeService.rehireEmployee(5, makeData(), "user1"),
    ).resolves.toEqual({ id: 5 });
  });

  it("enqueues an invalidate when an update deactivates an employee", async () => {
    mockPrisma.employee.findUnique.mockResolvedValue(
      makeExisting({ isActive: true }),
    );
    mockPrisma.employee.update.mockResolvedValue({ id: 5, isActive: false });

    await employeeService.updateEmployeePartial(5, { isActive: false }, "user1");

    expect(mockEnqueue).toHaveBeenCalledWith("ASSET_CHECKIN", { employeeId: 5 });
    expect(mockEnqueue).toHaveBeenCalledWith("REQUIREMENTS_CACHE_INVALIDATE", {
      employeeId: 5,
    });
  });

  it("enqueues nothing when an update leaves the employee active", async () => {
    mockPrisma.employee.findUnique.mockResolvedValue(
      makeExisting({ isActive: true }),
    );
    mockPrisma.employee.update.mockResolvedValue({ id: 5, isActive: true });

    await employeeService.updateEmployeePartial(5, { title: "Leading Hand" }, "user1");

    expect(mockEnqueue).not.toHaveBeenCalled();
  });
});
