import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    training: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
    trainingRequirement: { create: vi.fn(), deleteMany: vi.fn() },
    trainingTicketExemption: { deleteMany: vi.fn() },
    trainingRecords: { count: vi.fn() },
    sopAssessment: { count: vi.fn() },
    history: { create: vi.fn() },
  };
  return { mockPrisma };
});

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));
vi.mock("@/lib/jobs/jobQueue", () => ({ enqueue: vi.fn() }));

import { trainingService } from "@/lib/services/trainingService";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createTraining SOP pair link", () => {
  it("links the Task Sheet to the Practical via sopPartnerId", async () => {
    mockPrisma.training.create
      .mockResolvedValueOnce({ id: 1, title: "Pump Rebuild - Task Sheet" })
      .mockResolvedValueOnce({ id: 2, title: "Pump Rebuild - Practical" });
    mockPrisma.training.update.mockResolvedValue({
      id: 1,
      title: "Pump Rebuild - Task Sheet",
      sopPartnerId: 2,
    });

    await trainingService.createTraining(
      { category: "SOP", title: "Pump Rebuild" },
      "u1",
    );

    expect(mockPrisma.training.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { sopPartnerId: 2 },
    });
  });

  it("does not touch sopPartnerId for non-SOP trainings", async () => {
    mockPrisma.training.create.mockResolvedValueOnce({ id: 3, title: "Forklift" });

    await trainingService.createTraining(
      { category: "Internal", title: "Forklift" },
      "u1",
    );

    expect(mockPrisma.training.update).not.toHaveBeenCalled();
  });
});

describe("updateTraining non-SOP to SOP conversion", () => {
  it("links the converted Task Sheet to the new Practical and returns the linked row", async () => {
    mockPrisma.training.findUnique.mockResolvedValueOnce({
      id: 5,
      category: "Internal",
      title: "Pump Rebuild",
      requirements: [],
    });
    mockPrisma.training.update
      .mockResolvedValueOnce({
        id: 5,
        title: "Pump Rebuild - Task Sheet",
        category: "SOP",
      })
      .mockResolvedValueOnce({
        id: 5,
        title: "Pump Rebuild - Task Sheet",
        category: "SOP",
        sopPartnerId: 6,
      });
    mockPrisma.training.create.mockResolvedValueOnce({
      id: 6,
      title: "Pump Rebuild - Practical",
      category: "SOP",
    });

    const result = await trainingService.updateTraining(
      5,
      { category: "SOP", title: "Pump Rebuild" },
      "u1",
    );

    expect(mockPrisma.training.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 5 },
        data: { sopPartnerId: 6 },
      }),
    );
    expect(result).toEqual([
      expect.objectContaining({ id: 5, sopPartnerId: 6 }),
      expect.objectContaining({ id: 6 }),
    ]);
  });
});

describe("deleteTraining with SOP assessments", () => {
  it("blocks deletion when assessments exist even with zero records", async () => {
    mockPrisma.training.findUnique.mockResolvedValue({
      id: 1,
      category: "SOP",
      title: "Pump Rebuild - Task Sheet",
    });
    mockPrisma.trainingRecords.count.mockResolvedValue(0);
    mockPrisma.sopAssessment.count.mockResolvedValue(1);

    await expect(trainingService.deleteTraining(1, "u1")).rejects.toThrow(
      "TRAINING_HAS_SOP_ASSESSMENTS",
    );
    expect(mockPrisma.training.delete).not.toHaveBeenCalled();
  });
});
