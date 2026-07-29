import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    trainingRevision: { findUnique: vi.fn(), delete: vi.fn() },
    sopAssessment: { count: vi.fn() },
    quizResponse: { count: vi.fn() },
    history: { create: vi.fn() },
  };
  return { mockPrisma };
});

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));
vi.mock("@/lib/jobs/jobQueue", () => ({ enqueue: vi.fn() }));
vi.mock("@/lib/services/sopService", () => ({
  sopService: { copyForward: vi.fn() },
}));
vi.mock("@/lib/services/quizService", () => ({
  quizService: { copyForward: vi.fn() },
}));

import { trainingRevisionService } from "@/lib/services/trainingRevisionService";

beforeEach(() => vi.clearAllMocks());

describe("deleteRevision with SOP assessments", () => {
  it("blocks deletion when assessments are pinned to the revision", async () => {
    mockPrisma.trainingRevision.findUnique.mockResolvedValue({
      id: 10,
      records: [],
    });
    mockPrisma.sopAssessment.count.mockResolvedValue(2);

    await expect(trainingRevisionService.deleteRevision(10, "u1")).rejects.toThrow(
      "REVISION_HAS_ASSESSMENTS",
    );
    expect(mockPrisma.trainingRevision.delete).not.toHaveBeenCalled();
  });

  it("blocks deletion when quiz responses are pinned to the revision", async () => {
    mockPrisma.trainingRevision.findUnique.mockResolvedValue({
      id: 10,
      records: [],
    });
    mockPrisma.sopAssessment.count.mockResolvedValue(0);
    mockPrisma.quizResponse.count.mockResolvedValue(4);

    await expect(trainingRevisionService.deleteRevision(10, "u1")).rejects.toThrow(
      "REVISION_HAS_QUIZ_RESPONSES",
    );
    expect(mockPrisma.trainingRevision.delete).not.toHaveBeenCalled();
  });

  it("still deletes a revision with no records and no assessments", async () => {
    mockPrisma.trainingRevision.findUnique.mockResolvedValue({
      id: 10,
      records: [],
    });
    mockPrisma.sopAssessment.count.mockResolvedValue(0);
    mockPrisma.quizResponse.count.mockResolvedValue(0);

    await trainingRevisionService.deleteRevision(10, "u1");
    expect(mockPrisma.trainingRevision.delete).toHaveBeenCalledWith({ where: { id: 10 } });
  });
});
