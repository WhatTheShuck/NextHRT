// lib/services/__tests__/onboardingService.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, mockEnqueue } = vi.hoisted(() => {
  const txClient = {
    onboardingRequest: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    employee: {
      create: vi.fn(),
      // findMany feeds employeeDuplicateService's two-stage name scan (the
      // create-mode duplicate guard); findUnique/update are rehireInTx's.
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    history: {
      create: vi.fn(),
    },
  };
  const mockPrisma = {
    onboardingRequest: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    history: {
      create: vi.fn(),
    },
    // interactive transaction passes a tx client to the callback
    $transaction: vi.fn(async (cb: (tx: typeof txClient) => unknown) =>
      cb(txClient),
    ),
    _txClient: txClient,
  };
  return { mockPrisma, mockEnqueue: vi.fn() };
});

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));
vi.mock("@/lib/jobs/jobQueue", () => ({ enqueue: mockEnqueue }));

import { onboardingService } from "@/lib/services/onboardingService";

const tx = mockPrisma._txClient;

const basePayload = {
  programs: [{ programId: 1, referenceUserEmployeeId: 5 }],
  hardware: [{ hardwareItemId: 2, nonStandard: true, justification: "GPU" }],
  compliance: { letterOfOfferSigned: true },
  notes: { it: "set up VPN", hr: null, payroll: null },
};

const baseCreateData = {
  legalFirstName: "Jane",
  legalLastName: "Doe",
  title: "Engineer",
  departmentId: 3,
  locationId: 4,
  employmentStatus: "Permanent" as const,
  startDate: "2026-07-01",
  payload: basePayload,
};

beforeEach(() => {
  vi.clearAllMocks();
  // No name matches by default, so create-mode approvals take the happy path.
  tx.employee.findMany.mockResolvedValue([]);
});

describe("createRequest", () => {
  it("creates a pending request, derives employmentType, and serialises payload", async () => {
    mockPrisma.onboardingRequest.create.mockResolvedValue({ id: 10 });

    await onboardingService.createRequest(baseCreateData, "user-1");

    const arg = mockPrisma.onboardingRequest.create.mock.calls[0][0];
    expect(arg.data.status).toBe("Pending");
    expect(arg.data.employmentType).toBe("Internal"); // Permanent → Internal
    expect(arg.data.submittedByUser).toEqual({ connect: { id: "user-1" } });
    expect(JSON.parse(arg.data.payload)).toEqual(basePayload);
    expect(mockPrisma.history.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tableName: "OnboardingRequest",
          action: "CREATE",
          userId: "user-1",
        }),
      }),
    );
  });

  it("derives External for contractor statuses", async () => {
    mockPrisma.onboardingRequest.create.mockResolvedValue({ id: 11 });

    await onboardingService.createRequest(
      { ...baseCreateData, employmentStatus: "LabourContractor" },
      "user-1",
    );

    const arg = mockPrisma.onboardingRequest.create.mock.calls[0][0];
    expect(arg.data.employmentType).toBe("External");
  });
});

describe("getRequestById", () => {
  it("throws when the request does not exist", async () => {
    mockPrisma.onboardingRequest.findUnique.mockResolvedValue(null);

    await expect(onboardingService.getRequestById(999)).rejects.toThrow(
      "ONBOARDING_REQUEST_NOT_FOUND",
    );
  });
});

describe("approveRequest", () => {
  const pendingRequest = {
    id: 10,
    status: "Pending",
    legalFirstName: "Jane",
    legalLastName: "Doe",
    preferredFirstName: null,
    preferredLastName: null,
    title: "Engineer",
    departmentId: 3,
    locationId: 4,
    employmentStatus: "Permanent",
    employmentType: "Internal",
    startDate: new Date("2026-07-01"),
    jobFamilyId: null,
    medicalStandardId: null,
    pendingDepartmentRequestId: null,
    pendingLocationRequestId: null,
  };

  it("creates an Employee (no User), links it, and flips status to Approved", async () => {
    tx.onboardingRequest.findUnique.mockResolvedValue(pendingRequest);
    tx.employee.create.mockResolvedValue({ id: 77, legalFirstName: "Jane" });
    tx.onboardingRequest.update.mockResolvedValue({
      id: 10,
      status: "Approved",
      createdEmployeeId: 77,
    });

    const result = await onboardingService.approveRequest(10, "admin-1");

    // Employee created with preferred defaulting to legal
    const empArg = tx.employee.create.mock.calls[0][0];
    expect(empArg.data.preferredFirstName).toBe("Jane");
    expect(empArg.data.preferredLastName).toBe("Doe");
    expect(empArg.data.employmentType).toBe("Internal");
    expect(empArg.data).not.toHaveProperty("User");

    // request flipped + linked
    const updArg = tx.onboardingRequest.update.mock.calls[0][0];
    expect(updArg.data.status).toBe("Approved");
    expect(updArg.data.createdEmployeeId).toBe(77);
    expect(updArg.data.reviewedByUserId).toBe("admin-1");

    // history for both Employee CREATE and request UPDATE
    expect(tx.history.create).toHaveBeenCalledTimes(2);
    expect(result.employee.id).toBe(77);
  });

  it("applies Admin edits to the core HR fields before creating the Employee", async () => {
    tx.onboardingRequest.findUnique.mockResolvedValue(pendingRequest);
    tx.employee.create.mockResolvedValue({ id: 78 });
    tx.onboardingRequest.update.mockResolvedValue({ id: 10 });

    await onboardingService.approveRequest(10, "admin-1", {
      legalLastName: "Smith",
      employmentStatus: "LabourContractor",
    });

    const empArg = tx.employee.create.mock.calls[0][0];
    expect(empArg.data.legalLastName).toBe("Smith");
    expect(empArg.data.status).toBe("LabourContractor");
    expect(empArg.data.employmentType).toBe("External"); // re-derived from edit
  });

  it("rejects approving a non-pending request", async () => {
    tx.onboardingRequest.findUnique.mockResolvedValue({
      ...pendingRequest,
      status: "Approved",
    });

    await expect(
      onboardingService.approveRequest(10, "admin-1"),
    ).rejects.toThrow("ONBOARDING_REQUEST_NOT_PENDING");
    expect(tx.employee.create).not.toHaveBeenCalled();
  });

  it("throws when the request does not exist", async () => {
    tx.onboardingRequest.findUnique.mockResolvedValue(null);

    await expect(
      onboardingService.approveRequest(999, "admin-1"),
    ).rejects.toThrow("ONBOARDING_REQUEST_NOT_FOUND");
  });
});

describe("rejectRequest", () => {
  it("sets status to Rejected with review notes and logs history", async () => {
    mockPrisma.onboardingRequest.findUnique.mockResolvedValue({
      id: 10,
      status: "Pending",
    });
    mockPrisma.onboardingRequest.update.mockResolvedValue({
      id: 10,
      status: "Rejected",
    });

    await onboardingService.rejectRequest(10, "admin-1", "Hire fell through");

    const updArg = mockPrisma.onboardingRequest.update.mock.calls[0][0];
    expect(updArg.data.status).toBe("Rejected");
    expect(updArg.data.reviewNotes).toBe("Hire fell through");
    expect(mockPrisma.history.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tableName: "OnboardingRequest",
          action: "UPDATE",
        }),
      }),
    );
  });

  it("rejects a non-pending request", async () => {
    mockPrisma.onboardingRequest.findUnique.mockResolvedValue({
      id: 10,
      status: "Rejected",
    });

    await expect(
      onboardingService.rejectRequest(10, "admin-1", "x"),
    ).rejects.toThrow("ONBOARDING_REQUEST_NOT_PENDING");
    expect(mockPrisma.onboardingRequest.update).not.toHaveBeenCalled();
  });
});

describe("approveRequest — rehire mode", () => {
  const pendingRequest = {
    id: 10,
    status: "Pending",
    legalFirstName: "Jane",
    legalLastName: "Doe",
    preferredFirstName: null,
    preferredLastName: null,
    title: "Engineer",
    departmentId: 3,
    locationId: 4,
    employmentStatus: "Permanent",
    employmentType: "Internal",
    startDate: new Date("2026-07-01"),
    jobFamilyId: null,
    medicalStandardId: null,
    pendingDepartmentRequestId: null,
    pendingLocationRequestId: null,
  };

  const departed = {
    id: 77,
    legalFirstName: "Jane",
    legalLastName: "Doe",
    preferredFirstName: "Janey",
    preferredLastName: "Doe",
    title: "Fitter",
    startDate: new Date("2018-01-01T00:00:00.000Z"),
    finishDate: new Date("2020-06-30T00:00:00.000Z"),
    status: "Permanent",
    isActive: false,
    departmentId: 2,
    locationId: 3,
    department: { id: 2, name: "Maintenance" },
    location: { id: 3, name: "Perth" },
  };

  function wireRehire(existing: Record<string, unknown> = departed) {
    tx.onboardingRequest.findUnique.mockResolvedValue(pendingRequest);
    tx.employee.findUnique.mockResolvedValue(existing);
    tx.employee.update.mockResolvedValue({
      id: 77,
      legalFirstName: "Jane",
      legalLastName: "Doe",
    });
    tx.onboardingRequest.update.mockResolvedValue({ id: 10, status: "Approved" });
  }

  it("reactivates the existing record instead of creating a second one", async () => {
    wireRehire();

    const result = await onboardingService.approveRequest(10, "admin-1", undefined, {
      mode: "rehire",
      employeeId: 77,
    });

    expect(tx.employee.create).not.toHaveBeenCalled();
    expect(tx.employee.update).toHaveBeenCalledTimes(1);
    expect(result.employee.id).toBe(77);
  });

  it("writes a REHIRE history row and no Employee CREATE row", async () => {
    wireRehire();

    await onboardingService.approveRequest(10, "admin-1", undefined, {
      mode: "rehire",
      employeeId: 77,
    });

    const actions = tx.history.create.mock.calls.map(
      (c: any[]) => `${c[0].data.tableName}:${c[0].data.action}`,
    );
    expect(actions).toEqual(["Employee:REHIRE", "OnboardingRequest:UPDATE"]);
  });

  it("links both createdEmployeeId and rehireOfEmployeeId", async () => {
    wireRehire();

    await onboardingService.approveRequest(10, "admin-1", undefined, {
      mode: "rehire",
      employeeId: 77,
    });

    const data = tx.onboardingRequest.update.mock.calls[0][0].data;
    expect(data.createdEmployeeId).toBe(77);
    expect(data.rehireOfEmployeeId).toBe(77);
  });

  it("leaves rehireOfEmployeeId null in create mode", async () => {
    tx.onboardingRequest.findUnique.mockResolvedValue(pendingRequest);
    tx.employee.create.mockResolvedValue({
      id: 90,
      legalFirstName: "Jane",
      legalLastName: "Doe",
    });
    tx.onboardingRequest.update.mockResolvedValue({ id: 10 });

    await onboardingService.approveRequest(10, "admin-1");

    expect(
      tx.onboardingRequest.update.mock.calls[0][0].data.rehireOfEmployeeId,
    ).toBeNull();
  });

  it("takes the rehire start date from edits, not a decision field", async () => {
    wireRehire();

    await onboardingService.approveRequest(
      10,
      "admin-1",
      { startDate: "2026-08-03T00:00:00.000Z" },
      { mode: "rehire", employeeId: 77 },
    );

    const empData = tx.employee.update.mock.calls[0][0].data;
    expect(empData.startDate).toEqual(new Date("2026-08-03T00:00:00.000Z"));
    // …and the request records the same start, so the two rows cannot disagree.
    expect(tx.onboardingRequest.update.mock.calls[0][0].data.startDate).toEqual(
      new Date("2026-08-03T00:00:00.000Z"),
    );
  });

  it("writes legal names onto the Employee only when the Admin supplied them", async () => {
    wireRehire();
    await onboardingService.approveRequest(10, "admin-1", undefined, {
      mode: "rehire",
      employeeId: 77,
    });
    expect(
      tx.employee.update.mock.calls[0][0].data.legalFirstName,
    ).toBeUndefined();

    vi.clearAllMocks();
    tx.employee.findMany.mockResolvedValue([]);
    wireRehire();
    await onboardingService.approveRequest(10, "admin-1", undefined, {
      mode: "rehire",
      employeeId: 77,
      legalFirstName: "Jayne",
      legalLastName: "Doherty",
    });
    expect(tx.employee.update.mock.calls[0][0].data.legalFirstName).toBe("Jayne");
    expect(tx.employee.update.mock.calls[0][0].data.legalLastName).toBe("Doherty");
  });

  it("persists the resulting legal names back onto the request", async () => {
    wireRehire();

    await onboardingService.approveRequest(
      10,
      "admin-1",
      { legalFirstName: "Janet" },
      { mode: "rehire", employeeId: 77 },
    );

    // The Admin kept the existing record's names, so the request must record those
    // rather than the edit — otherwise the two rows disagree about a legal name.
    const data = tx.onboardingRequest.update.mock.calls[0][0].data;
    expect(data.legalFirstName).toBe("Jane");
    expect(data.legalLastName).toBe("Doe");
  });

  it("passes keep/clear through for the three optional fields", async () => {
    wireRehire();

    await onboardingService.approveRequest(10, "admin-1", undefined, {
      mode: "rehire",
      employeeId: 77,
      optionalFields: { preferredFirstName: null, jobFamilyId: 4 },
    });

    const data = tx.employee.update.mock.calls[0][0].data;
    expect(data.preferredFirstName).toBeNull(); // clear
    expect(data.preferredLastName).toBeUndefined(); // don't touch
    expect(data.jobFamily).toEqual({ connect: { id: 4 } });
    // usi/notes have no request columns, so they can never be reconciled here.
    expect(data.usi).toBeUndefined();
    expect(data.notes).toBeUndefined();
  });

  it("rejects an active rehire target", async () => {
    wireRehire({ ...departed, isActive: true });

    await expect(
      onboardingService.approveRequest(10, "admin-1", undefined, {
        mode: "rehire",
        employeeId: 77,
      }),
    ).rejects.toThrow("ACTIVE_EMPLOYEE");
    expect(tx.employee.update).not.toHaveBeenCalled();
  });

  it("rejects a missing rehire target", async () => {
    wireRehire();
    tx.employee.findUnique.mockResolvedValue(null);

    await expect(
      onboardingService.approveRequest(10, "admin-1", undefined, {
        mode: "rehire",
        employeeId: 999,
      }),
    ).rejects.toThrow("EMPLOYEE_NOT_FOUND");
  });

  it("rejects a start date on or before the prior finish", async () => {
    wireRehire();

    await expect(
      onboardingService.approveRequest(
        10,
        "admin-1",
        { startDate: "2019-01-01T00:00:00.000Z" },
        { mode: "rehire", employeeId: 77 },
      ),
    ).rejects.toThrow("INVALID_REHIRE_DATE");
  });

  it("rejects an unparseable start date", async () => {
    wireRehire();

    await expect(
      onboardingService.approveRequest(
        10,
        "admin-1",
        { startDate: "not-a-date" },
        { mode: "rehire", employeeId: 77 },
      ),
    ).rejects.toThrow("INVALID_REHIRE_DATE");
  });

  it("rejects an unrecognised mode instead of falling through to create", async () => {
    tx.onboardingRequest.findUnique.mockResolvedValue(pendingRequest);

    await expect(
      onboardingService.approveRequest(10, "admin-1", undefined, {
        mode: "rehir",
      } as never),
    ).rejects.toThrow("INVALID_APPROVAL_DECISION");
    expect(tx.employee.create).not.toHaveBeenCalled();
    expect(tx.employee.update).not.toHaveBeenCalled();
  });

  it("enqueues a requirements-cache invalidate after a rehire commits", async () => {
    wireRehire();

    await onboardingService.approveRequest(10, "admin-1", undefined, {
      mode: "rehire",
      employeeId: 77,
    });

    expect(mockEnqueue).toHaveBeenCalledWith("REQUIREMENTS_CACHE_INVALIDATE", {
      employeeId: 77,
    });
    expect(mockEnqueue.mock.invocationCallOrder[0]).toBeGreaterThan(
      tx.employee.update.mock.invocationCallOrder[0],
    );
  });

  it("enqueues nothing extra in create mode", async () => {
    tx.onboardingRequest.findUnique.mockResolvedValue(pendingRequest);
    tx.employee.create.mockResolvedValue({
      id: 90,
      legalFirstName: "Jane",
      legalLastName: "Doe",
    });
    tx.onboardingRequest.update.mockResolvedValue({ id: 10 });

    await onboardingService.approveRequest(10, "admin-1");

    expect(mockEnqueue).not.toHaveBeenCalled();
  });
});

describe("approveRequest — create-mode duplicate guard", () => {
  const pendingRequest = {
    id: 10,
    status: "Pending",
    legalFirstName: "Jane",
    legalLastName: "Doe",
    preferredFirstName: null,
    preferredLastName: null,
    title: "Engineer",
    departmentId: 3,
    locationId: 4,
    employmentStatus: "Permanent",
    employmentType: "Internal",
    startDate: new Date("2026-07-01"),
    jobFamilyId: null,
    medicalStandardId: null,
    pendingDepartmentRequestId: null,
    pendingLocationRequestId: null,
  };

  /** A name match, as employeeDuplicateService's two-stage read returns it. */
  function wireMatch() {
    tx.onboardingRequest.findUnique.mockResolvedValue(pendingRequest);
    tx.employee.findMany
      .mockReset()
      .mockResolvedValueOnce([{ id: 77, legalFirstName: "jane", legalLastName: "DOE" }])
      .mockResolvedValueOnce([
        {
          id: 77,
          legalFirstName: "jane",
          legalLastName: "DOE",
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
          startDate: new Date("2018-01-01T00:00:00.000Z"),
          finishDate: new Date("2020-06-30T00:00:00.000Z"),
        },
      ]);
    tx.employee.create.mockResolvedValue({
      id: 90,
      legalFirstName: "Jane",
      legalLastName: "Doe",
    });
    tx.onboardingRequest.update.mockResolvedValue({ id: 10 });
  }

  it("refuses to create over a name match and creates no Employee", async () => {
    wireMatch();

    await expect(
      onboardingService.approveRequest(10, "admin-1"),
    ).rejects.toMatchObject({ code: "DUPLICATE_EMPLOYEE" });
    expect(tx.employee.create).not.toHaveBeenCalled();
    expect(tx.onboardingRequest.update).not.toHaveBeenCalled();
  });

  it("carries the matches and suggestions the approval UI needs", async () => {
    wireMatch();

    let thrown: Record<string, any> = {};
    try {
      await onboardingService.approveRequest(10, "admin-1");
    } catch (e) {
      thrown = e as Record<string, any>;
    }

    expect(thrown.suggestions).toEqual({ rehire: true, duplicate: true });
    expect(thrown.matches).toHaveLength(1);
    expect(thrown.matches[0].id).toBe(77);
  });

  it("creates the Employee when the Admin explicitly confirms", async () => {
    wireMatch();

    await onboardingService.approveRequest(10, "admin-1", undefined, {
      mode: "create",
      confirmDuplicate: true,
    });

    expect(tx.employee.create).toHaveBeenCalledTimes(1);
    // The confirmation skips the lookup entirely.
    expect(tx.employee.findMany).not.toHaveBeenCalled();
  });

  it("fails closed on a junk confirmDuplicate value", async () => {
    wireMatch();

    await expect(
      onboardingService.approveRequest(10, "admin-1", undefined, {
        mode: "create",
        confirmDuplicate: "yes" as never,
      }),
    ).rejects.toMatchObject({ code: "DUPLICATE_EMPLOYEE" });
  });

  it("matches case-insensitively — the case the old equals check let through", async () => {
    // Stored "jane"/"DOE" against a request for "Jane"/"Doe".
    wireMatch();

    await expect(
      onboardingService.approveRequest(10, "admin-1"),
    ).rejects.toMatchObject({ code: "DUPLICATE_EMPLOYEE" });
  });
});
