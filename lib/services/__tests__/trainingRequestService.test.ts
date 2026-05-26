import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => {
  const mockTx = {
    trainingRequest: {
      create: vi.fn(),
    },
  };
  const mockPrisma = {
    trainingRequest: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    trainingRecords: {
      create: vi.fn(),
    },
    $transaction: vi.fn((fn: any) => fn(mockTx)),
  };
  return { mockPrisma, mockTx };
});

const { mockApprovalService } = vi.hoisted(() => ({
  mockApprovalService: { createRequest: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));
vi.mock("@/lib/auth", () => ({ auth: { api: { userHasPermission: vi.fn() } } }));
vi.mock("../auth", () => ({ auth: { api: { userHasPermission: vi.fn() } } }));
vi.mock("@/lib/services/approvalService", () => ({ approvalService: mockApprovalService }));

import { trainingRequestService } from "@/lib/services/trainingRequestService";

beforeEach(() => vi.clearAllMocks());

describe("trainingRequestService.createTrainingRequest", () => {
  it("throws INVALID_REQUEST when both trainingId and trainingCourseRequestId are null", async () => {
    await expect(
      trainingRequestService.createTrainingRequest({
        employeeId: 1,
        submittedByUserId: "user-1",
        trainingId: null,
        trainingCourseRequestId: null,
      }),
    ).rejects.toThrow("INVALID_REQUEST");
  });

  it("creates TrainingRequest and ApprovalRequest when trainingId is provided", async () => {
    mockApprovalService.createRequest.mockResolvedValue({ id: 10 });
    mockPrisma.$transaction.mockImplementation((fn: any) =>
      fn({
        trainingRequest: {
          create: vi.fn().mockResolvedValue({ id: 1, approvalRequestId: 10 }),
        },
      }),
    );

    const result = await trainingRequestService.createTrainingRequest({
      employeeId: 1,
      submittedByUserId: "user-1",
      trainingId: 5,
      trainingCourseRequestId: null,
    });

    expect(mockApprovalService.createRequest).toHaveBeenCalledWith(
      expect.objectContaining({ requestType: "Training", submittedByUserId: "user-1" }),
    );
    expect(result.trainingRequest.id).toBe(1);
  });
});

describe("trainingRequestService.finaliseApproval", () => {
  it("throws COURSE_REQUEST_UNRESOLVED when trainingId is null", async () => {
    mockPrisma.trainingRequest.findUnique.mockResolvedValue({
      id: 1,
      trainingId: null,
      employeeId: 2,
      trainingDate: null,
      approvalRequest: { submittedByUser: { name: "Jane" } },
    });

    await expect(trainingRequestService.finaliseApproval(1)).rejects.toThrow(
      "COURSE_REQUEST_UNRESOLVED",
    );
  });

  it("creates TrainingRecords using submitter name as trainer", async () => {
    const trainingDate = new Date("2026-05-01");
    mockPrisma.trainingRequest.findUnique.mockResolvedValue({
      id: 1,
      trainingId: 7,
      employeeId: 2,
      trainingDate,
      approvalRequest: { submittedByUser: { name: "Jane Doe" } },
    });
    mockPrisma.trainingRecords.create.mockResolvedValue({ id: 99 });

    await trainingRequestService.finaliseApproval(1);

    expect(mockPrisma.trainingRecords.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        employeeId: 2,
        trainingId: 7,
        trainer: "Jane Doe",
        dateCompleted: trainingDate,
      }),
    });
  });

  it("uses current date when trainingDate is null", async () => {
    mockPrisma.trainingRequest.findUnique.mockResolvedValue({
      id: 1,
      trainingId: 7,
      employeeId: 2,
      trainingDate: null,
      approvalRequest: { submittedByUser: { name: "Jane Doe" } },
    });
    mockPrisma.trainingRecords.create.mockResolvedValue({ id: 99 });

    await trainingRequestService.finaliseApproval(1);

    const call = mockPrisma.trainingRecords.create.mock.calls[0][0];
    expect(call.data.dateCompleted).toBeInstanceOf(Date);
  });
});

describe("trainingRequestService.getRequestsForUser", () => {
  it("filters by submittedByUserId only when no employeeId provided", async () => {
    mockPrisma.trainingRequest.findMany.mockResolvedValue([]);

    await trainingRequestService.getRequestsForUser("user-1");

    expect(mockPrisma.trainingRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { approvalRequest: { submittedByUserId: "user-1" } },
        orderBy: { createdAt: "desc" },
      }),
    );
  });

  it("uses OR query when employeeId is provided", async () => {
    mockPrisma.trainingRequest.findMany.mockResolvedValue([]);

    await trainingRequestService.getRequestsForUser("user-1", 42);

    expect(mockPrisma.trainingRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { approvalRequest: { submittedByUserId: "user-1" } },
            { employeeId: 42 },
          ],
        },
        orderBy: { createdAt: "desc" },
      }),
    );
  });

  it("includes submittedByUserId in approvalRequest select", async () => {
    mockPrisma.trainingRequest.findMany.mockResolvedValue([]);

    await trainingRequestService.getRequestsForUser("user-1");

    const call = mockPrisma.trainingRequest.findMany.mock.calls[0][0];
    expect(call.include.approvalRequest.select).toMatchObject({
      submittedByUserId: true,
      submittedByUser: expect.anything(),
    });
  });
});

describe("trainingRequestService.getTrainingRequestDetails", () => {
  it("fetches by id with full include tree", async () => {
    mockPrisma.trainingRequest.findUnique.mockResolvedValue(null);

    await trainingRequestService.getTrainingRequestDetails(42);

    expect(mockPrisma.trainingRequest.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 42 },
        include: expect.objectContaining({
          approvalRequest: expect.anything(),
          employee: expect.anything(),
          training: expect.anything(),
          trainingCourseRequest: expect.anything(),
        }),
      }),
    );
  });
});
