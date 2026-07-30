import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockEnqueue } = vi.hoisted(() => ({ mockEnqueue: vi.fn() }));

vi.mock("@/lib/jobs/jobQueue", () => ({ enqueue: mockEnqueue }));

import {
  enqueueRequirementsCacheInvalidate,
  rehireInTx,
  type RehireData,
} from "@/lib/services/employeeRehire";

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
    phone: "08 9999 0000",
    mobile: "0400 000 000",
    departmentId: 2,
    locationId: 3,
    department: { id: 2, name: "Maintenance" },
    location: { id: 3, name: "Perth" },
    ...overrides,
  };
}

function makeData(overrides: Record<string, unknown> = {}): RehireData {
  return {
    startDate: "2024-01-15T00:00:00.000Z",
    title: "Senior Fitter",
    departmentId: 7,
    locationId: 8,
    status: "LabourContractor",
    ...overrides,
  };
}

function makeTx(existing: Record<string, unknown> | null = makeExisting()) {
  return {
    employee: {
      findUnique: vi.fn().mockResolvedValue(existing),
      update: vi.fn().mockResolvedValue({ id: 5 }),
    },
    history: { create: vi.fn().mockResolvedValue({}) },
  };
}

/** The data object handed to `tx.employee.update`. */
function updateData(tx: ReturnType<typeof makeTx>) {
  return tx.employee.update.mock.calls[0][0].data;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("rehireInTx", () => {
  it("reads the existing record through the supplied tx, not a new connection", async () => {
    const tx = makeTx();

    await rehireInTx(tx as never, 5, makeData(), "user1");

    // The whole point of the extraction: no nested $transaction, no module
    // singleton — everything goes through the caller's client.
    expect(tx.employee.findUnique).toHaveBeenCalledWith({
      where: { id: 5 },
      include: { department: true, location: true },
    });
  });

  it("clears phone and mobile so a stale landline/SIM does not follow the rehire", async () => {
    const tx = makeTx();

    await rehireInTx(tx as never, 5, makeData(), "user1");

    expect(updateData(tx).phone).toBeNull();
    expect(updateData(tx).mobile).toBeNull();
  });

  it("keeps the department/location includes the fan-out depends on", async () => {
    const tx = makeTx();

    await rehireInTx(tx as never, 5, makeData(), "user1");

    expect(tx.employee.update.mock.calls[0][0].include).toEqual({
      department: true,
      location: true,
    });
  });

  it("accepts a Date startDate as well as a string", async () => {
    const tx = makeTx();

    await rehireInTx(
      tx as never,
      5,
      makeData({ startDate: new Date("2024-01-15T00:00:00.000Z") }),
      "user1",
    );

    expect(updateData(tx).startDate).toEqual(
      new Date("2024-01-15T00:00:00.000Z"),
    );
  });

  it("writes legal names only when supplied", async () => {
    const withoutNames = makeTx();
    await rehireInTx(withoutNames as never, 5, makeData(), "user1");
    expect(updateData(withoutNames).legalFirstName).toBeUndefined();
    expect(updateData(withoutNames).legalLastName).toBeUndefined();

    const withNames = makeTx();
    await rehireInTx(
      withNames as never,
      5,
      makeData({ legalFirstName: "Jayne", legalLastName: "Smythe" }),
      "user1",
    );
    expect(updateData(withNames).legalFirstName).toBe("Jayne");
    expect(updateData(withNames).legalLastName).toBe("Smythe");
  });

  it("leaves usi/notes untouched when the caller cannot reconcile them", async () => {
    // The onboarding path has no usi/notes columns to offer, so it passes neither
    // and Prisma must read that as "don't touch", not "clear".
    const tx = makeTx();

    await rehireInTx(tx as never, 5, makeData(), "user1");

    expect(updateData(tx).usi).toBeUndefined();
    expect(updateData(tx).notes).toBeUndefined();
  });

  it("distinguishes clear (null) from don't-touch (undefined) on optional fields", async () => {
    const tx = makeTx();

    await rehireInTx(
      tx as never,
      5,
      makeData({ preferredFirstName: null, jobFamilyId: null }),
      "user1",
    );

    expect(updateData(tx).preferredFirstName).toBeNull();
    expect(updateData(tx).preferredLastName).toBeUndefined();
    expect(updateData(tx).jobFamily).toEqual({ disconnect: true });
  });

  it("archives the prior stint and sets hasPriorEmployment", async () => {
    const tx = makeTx();

    await rehireInTx(tx as never, 5, makeData(), "user1");

    const row = tx.history.create.mock.calls[0][0].data;
    expect(row.action).toBe("REHIRE");
    expect(row.tableName).toBe("Employee");
    expect(row.recordId).toBe("5");
    expect(JSON.parse(row.oldValues)).toMatchObject({
      departmentName: "Maintenance",
      locationName: "Perth",
      title: "Fitter",
      finishDate: PRIOR_FINISH.toISOString(),
    });
    expect(updateData(tx).hasPriorEmployment).toBe(true);
    expect(updateData(tx).isActive).toBe(true);
    expect(updateData(tx).finishDate).toBeNull();
  });

  it("throws EMPLOYEE_NOT_FOUND when the target does not exist", async () => {
    const tx = makeTx(null);

    await expect(rehireInTx(tx as never, 5, makeData(), "user1")).rejects.toThrow(
      "EMPLOYEE_NOT_FOUND",
    );
    expect(tx.employee.update).not.toHaveBeenCalled();
  });

  it("throws ACTIVE_EMPLOYEE for a still-active target", async () => {
    const tx = makeTx(makeExisting({ isActive: true }));

    await expect(rehireInTx(tx as never, 5, makeData(), "user1")).rejects.toThrow(
      "ACTIVE_EMPLOYEE",
    );
    expect(tx.employee.update).not.toHaveBeenCalled();
  });

  it("throws MISSING_FINISH_DATE when neither the record nor the caller has one", async () => {
    const tx = makeTx(makeExisting({ finishDate: null }));

    await expect(rehireInTx(tx as never, 5, makeData(), "user1")).rejects.toThrow(
      "MISSING_FINISH_DATE",
    );
  });

  it("uses the supplied priorFinishDate when the record's is null", async () => {
    const tx = makeTx(makeExisting({ finishDate: null }));

    await rehireInTx(
      tx as never,
      5,
      makeData({ priorFinishDate: "2023-01-01T00:00:00.000Z" }),
      "user1",
    );

    const oldStint = JSON.parse(tx.history.create.mock.calls[0][0].data.oldValues);
    expect(oldStint.finishDate).toBe("2023-01-01T00:00:00.000Z");
  });

  it("rejects a start on or before the prior finish", async () => {
    const tx = makeTx();

    await expect(
      rehireInTx(
        tx as never,
        5,
        makeData({ startDate: "2020-06-30T00:00:00.000Z" }),
        "user1",
      ),
    ).rejects.toThrow("INVALID_REHIRE_DATE");
    expect(tx.employee.update).not.toHaveBeenCalled();
  });

  it("rejects an unparseable startDate instead of letting the guard pass", async () => {
    // C5: an Invalid Date makes every comparison false, so without the isNaN
    // check `rehireStart <= priorFinish` silently evaluated to "pass".
    const tx = makeTx();

    await expect(
      rehireInTx(tx as never, 5, makeData({ startDate: "not-a-date" }), "user1"),
    ).rejects.toThrow("INVALID_REHIRE_DATE");
    expect(tx.employee.update).not.toHaveBeenCalled();
  });

  it("rejects an unparseable priorFinishDate", async () => {
    const tx = makeTx(makeExisting({ finishDate: null }));

    await expect(
      rehireInTx(
        tx as never,
        5,
        makeData({ priorFinishDate: "whenever" }),
        "user1",
      ),
    ).rejects.toThrow("INVALID_REHIRE_DATE");
  });
});

describe("enqueueRequirementsCacheInvalidate", () => {
  it("enqueues the invalidate job for the employee", async () => {
    await enqueueRequirementsCacheInvalidate(5);

    expect(mockEnqueue).toHaveBeenCalledWith("REQUIREMENTS_CACHE_INVALIDATE", {
      employeeId: 5,
    });
  });

  it("swallows an enqueue failure so it cannot fail a committed write", async () => {
    mockEnqueue.mockRejectedValueOnce(new Error("queue down"));

    await expect(enqueueRequirementsCacheInvalidate(5)).resolves.toBeUndefined();
  });
});
