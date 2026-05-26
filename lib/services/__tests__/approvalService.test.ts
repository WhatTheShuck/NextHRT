import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    approvalRequest: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    approvalAction: {
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(), // needed for reevaluatePendingRequests
    },
    department: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  return { mockPrisma };
});

const { mockLogService } = vi.hoisted(() => ({
  mockLogService: { log: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));
vi.mock("@/lib/auth", () => ({ auth: { api: { userHasPermission: vi.fn() } } }));
vi.mock("../auth", () => ({ auth: { api: { userHasPermission: vi.fn() } } }));
vi.mock("@/lib/services/logService", () => ({ logService: mockLogService }));

import { approvalService } from "@/lib/services/approvalService";
import { auth } from "../../auth";

beforeEach(() => vi.clearAllMocks());

describe("approvalService.createRequest", () => {
  it("creates an ApprovalRequest with Pending status at DepartmentManager stage", async () => {
    mockPrisma.approvalRequest.create.mockResolvedValue({ id: 1, status: "Pending", currentStage: "DepartmentManager" });

    const result = await approvalService.createRequest({
      requestType: "Training",
      submittedByUserId: "user-1",
    });

    expect(mockPrisma.approvalRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        requestType: "Training",
        status: "Pending",
        currentStage: "DepartmentManager",
        submittedByUserId: "user-1",
      }),
    });
    expect(result.status).toBe("Pending");
  });
});

describe("approvalService.recordDecision", () => {
  const baseRequest = {
    id: 1,
    status: "Pending",
    currentStage: "DepartmentManager",
    nominatedApproverEmployeeId: 42,
    submittedByUserId: "submitter-1",
    trainingRequest: { employeeId: 10 },
  };

  beforeEach(() => {
    mockPrisma.approvalRequest.findUnique.mockResolvedValue(baseRequest);
    mockPrisma.user.findUnique.mockResolvedValue({ id: "user-1", employeeId: 99 }); // not nominated
    mockPrisma.approvalAction.create.mockResolvedValue({});
    mockPrisma.approvalRequest.update.mockResolvedValue({});
  });

  it("throws when onBehalfOf is true and no comment provided", async () => {
    // user employeeId (99) !== nominatedApproverEmployeeId (42) => onBehalfOf = true
    await expect(
      approvalService.recordDecision({
        requestId: 1,
        userId: "user-1",
        decision: "Approved",
        comment: undefined,
      }),
    ).rejects.toThrow("COMMENT_REQUIRED");
  });

  it("throws when decision is Rejected and no comment provided", async () => {
    // Make user the nominated approver so onBehalfOf = false
    mockPrisma.user.findUnique.mockResolvedValue({ id: "user-1", employeeId: 42 });

    await expect(
      approvalService.recordDecision({
        requestId: 1,
        userId: "user-1",
        decision: "Rejected",
        comment: undefined,
      }),
    ).rejects.toThrow("COMMENT_REQUIRED");
  });

  it("advances stage from DepartmentManager to HRManager on approval", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: "user-1", employeeId: 42 });
    mockPrisma.approvalRequest.findUnique
      .mockResolvedValueOnce(baseRequest) // first call in recordDecision
      .mockResolvedValue({ ...baseRequest, actions: [], trainingRequest: null }); // final findUnique

    await approvalService.recordDecision({
      requestId: 1,
      userId: "user-1",
      decision: "Approved",
      comment: undefined,
    });

    expect(mockPrisma.approvalRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ currentStage: "HRManager" }),
      }),
    );
  });

  it("advances stage from HRManager to Admin on approval", async () => {
    mockPrisma.approvalRequest.findUnique
      .mockResolvedValueOnce({
        ...baseRequest,
        currentStage: "HRManager",
        nominatedApproverEmployeeId: null,
      })
      .mockResolvedValue({ ...baseRequest, actions: [], trainingRequest: null });
    mockPrisma.user.findUnique.mockResolvedValue({ id: "user-1", employeeId: 42 });

    await approvalService.recordDecision({
      requestId: 1,
      userId: "user-1",
      decision: "Approved",
    });

    expect(mockPrisma.approvalRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ currentStage: "Admin" }),
      }),
    );
  });

  it("sets status to Approved on Admin stage approval", async () => {
    mockPrisma.approvalRequest.findUnique
      .mockResolvedValueOnce({
        ...baseRequest,
        currentStage: "Admin",
        nominatedApproverEmployeeId: null,
      })
      .mockResolvedValue({ ...baseRequest, actions: [], trainingRequest: null });
    mockPrisma.user.findUnique.mockResolvedValue({ id: "user-1", employeeId: 42 });

    await approvalService.recordDecision({
      requestId: 1,
      userId: "user-1",
      decision: "Approved",
    });

    expect(mockPrisma.approvalRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "Approved" }),
      }),
    );
  });

  it("sets status to Rejected on any stage rejection", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: "user-1", employeeId: 42 });
    mockPrisma.approvalRequest.findUnique
      .mockResolvedValueOnce(baseRequest)
      .mockResolvedValue({ ...baseRequest, actions: [], trainingRequest: null });

    await approvalService.recordDecision({
      requestId: 1,
      userId: "user-1",
      decision: "Rejected",
      comment: "Not justified",
    });

    expect(mockPrisma.approvalRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "Rejected" }),
      }),
    );
  });
});

describe("approvalService.getPendingCountForUser", () => {
  it("returns 0 when user has no managed departments and no special permissions", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      role: "User",
      canManageChildrenDepartments: false,
      managedDepartments: [],
    });
    vi.mocked(auth.api.userHasPermission).mockResolvedValue({ success: false } as any);
    mockPrisma.approvalRequest.findMany.mockResolvedValue([]);

    const count = await approvalService.getPendingCountForUser("user-1");
    expect(count).toBe(0);
  });

  it("returns HR-stage requests when user has approveAsHR permission", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-hr",
      role: "User",
      canManageChildrenDepartments: false,
      managedDepartments: [],
    });
    // Return true for approveAsHR, false for adminApprove
    vi.mocked(auth.api.userHasPermission)
      .mockResolvedValueOnce({ success: true } as any)  // approveAsHR
      .mockResolvedValueOnce({ success: false } as any); // adminApprove

    const hrRequest = { id: 5, status: "Pending", currentStage: "HRManager" };
    mockPrisma.approvalRequest.findMany.mockResolvedValue([hrRequest]);

    const count = await approvalService.getPendingCountForUser("user-hr");
    expect(count).toBe(1);
  });
});

describe("approvalService.reevaluatePendingRequests", () => {
  it("logs a warning for each pending request with no eligible approvers", async () => {
    // A pending request for employee in dept 5
    mockPrisma.approvalRequest.findMany.mockResolvedValue([
      {
        id: 1,
        requestType: "Training",
        currentStage: "DepartmentManager",
        trainingRequest: { employee: { departmentId: 5 } },
      },
    ]);
    // No DMs for dept 5
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockLogService.log.mockResolvedValue(undefined);

    await approvalService.reevaluatePendingRequests();

    expect(mockLogService.log).toHaveBeenCalledWith(
      expect.stringContaining("#1"),
      "Warning",
      "REEVALUATE_PENDING_APPROVALS",
    );
  });
});
