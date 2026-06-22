// lib/services/__tests__/onboardingService.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => {
  const txClient = {
    onboardingRequest: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    employee: {
      create: vi.fn(),
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
  return { mockPrisma };
});

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

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
