import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    trainingCourseRequest: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    training: {
      create: vi.fn(),
    },
  };
  return { mockPrisma };
});

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import { trainingCourseRequestService } from "@/lib/services/trainingCourseRequestService";

beforeEach(() => vi.clearAllMocks());

describe("trainingCourseRequestService.submitCourseRequest", () => {
  it("creates a pending TrainingCourseRequest", async () => {
    mockPrisma.trainingCourseRequest.create.mockResolvedValue({ id: 1, status: "Pending" });

    const result = await trainingCourseRequestService.submitCourseRequest(
      "Advanced Rigging",
      "For crane operators",
      "user-1",
    );

    expect(mockPrisma.trainingCourseRequest.create).toHaveBeenCalledWith({
      data: {
        name: "Advanced Rigging",
        description: "For crane operators",
        requestedByUserId: "user-1",
        status: "Pending",
      },
    });
    expect(result.status).toBe("Pending");
  });
});

describe("trainingCourseRequestService.resolveCourseRequest", () => {
  it("creates a Training record and sets resolvedTrainingId on approval", async () => {
    mockPrisma.trainingCourseRequest.findUnique.mockResolvedValue({ id: 1, status: "Pending" });
    mockPrisma.training.create.mockResolvedValue({ id: 5 });
    mockPrisma.trainingCourseRequest.update.mockResolvedValue({ id: 1, status: "Approved", resolvedTrainingId: 5 });

    const result = await trainingCourseRequestService.resolveCourseRequest(1, "Approved", {
      title: "Advanced Rigging",
      category: "Internal",
    });

    expect(mockPrisma.training.create).toHaveBeenCalled();
    expect(mockPrisma.trainingCourseRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "Approved", resolvedTrainingId: 5 }),
      }),
    );
    expect(result.status).toBe("Approved");
  });

  it("sets status to Rejected without creating a Training record", async () => {
    mockPrisma.trainingCourseRequest.findUnique.mockResolvedValue({ id: 1, status: "Pending" });
    mockPrisma.trainingCourseRequest.update.mockResolvedValue({ id: 1, status: "Rejected" });

    await trainingCourseRequestService.resolveCourseRequest(1, "Rejected");

    expect(mockPrisma.training.create).not.toHaveBeenCalled();
    expect(mockPrisma.trainingCourseRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "Rejected" } }),
    );
  });

  it("throws NOT_FOUND when request does not exist", async () => {
    mockPrisma.trainingCourseRequest.findUnique.mockResolvedValue(null);

    await expect(
      trainingCourseRequestService.resolveCourseRequest(999, "Approved", {
        title: "X",
        category: "Internal",
      }),
    ).rejects.toThrow("NOT_FOUND");
  });

  it("throws TRAINING_DATA_REQUIRED when approving without trainingData", async () => {
    mockPrisma.trainingCourseRequest.findUnique.mockResolvedValue({ id: 1, status: "Pending" });

    await expect(
      trainingCourseRequestService.resolveCourseRequest(1, "Approved"),
    ).rejects.toThrow("TRAINING_DATA_REQUIRED");
  });
});
