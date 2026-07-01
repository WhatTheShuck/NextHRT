import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, mockEnqueue } = vi.hoisted(() => {
  const mockPrisma = {
    training: {
      findUnique: vi.fn(),
    },
    trainingRevision: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    history: {
      create: vi.fn(),
    },
  };
  const mockEnqueue = vi.fn();
  return { mockPrisma, mockEnqueue };
});

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));
vi.mock("@/lib/jobs/jobQueue", () => ({ enqueue: mockEnqueue }));

import { trainingRevisionService } from "@/lib/services/trainingRevisionService";

const pastDate = new Date("2020-01-01T00:00:00Z");
const futureDate = new Date("2099-01-01T00:00:00Z");

const trainingWithRevisions = (revisions: object[]) => ({
  id: 10,
  requiresRetrainingOnRevision: true,
  revisions,
});

const revisionRow = (id: number, effectiveDate: Date, over: boolean | null = null) => ({
  id,
  trainingId: 10,
  revisionLabel: `Rev ${id}`,
  effectiveDate,
  createdAt: new Date("2020-01-01"),
  description: null,
  overrideRequiresRetraining: over,
  records: [],
});

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.trainingRevision.create.mockResolvedValue(revisionRow(1, pastDate));
  mockPrisma.trainingRevision.findUnique.mockResolvedValue(revisionRow(1, pastDate));
  mockPrisma.trainingRevision.update.mockResolvedValue(revisionRow(1, pastDate));
  mockPrisma.trainingRevision.delete.mockResolvedValue(revisionRow(1, pastDate));
  mockPrisma.history.create.mockResolvedValue({});
});

describe("trainingRevisionService.listForTraining", () => {
  it("returns revisions for the given training ordered by effectiveDate desc", async () => {
    const rows = [revisionRow(2, new Date("2024-01-01")), revisionRow(1, pastDate)];
    mockPrisma.trainingRevision.findMany.mockResolvedValue(rows);

    const result = await trainingRevisionService.listForTraining(10);

    expect(mockPrisma.trainingRevision.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { trainingId: 10 } }),
    );
    expect(result).toEqual(rows);
  });
});

describe("trainingRevisionService.createRevision", () => {
  it("creates a revision and writes a history row", async () => {
    mockPrisma.training.findUnique.mockResolvedValue(
      trainingWithRevisions([revisionRow(1, pastDate)]),
    );

    await trainingRevisionService.createRevision(
      { trainingId: 10, revisionLabel: "2024 Edition", effectiveDate: pastDate },
      "u1",
    );

    expect(mockPrisma.trainingRevision.create).toHaveBeenCalledOnce();
    expect(mockPrisma.history.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tableName: "TrainingRevision", action: "CREATE" }),
      }),
    );
  });

  it("enqueues REQUIREMENTS_CACHE_REBUILD when the new revision is current and requires retraining", async () => {
    mockPrisma.training.findUnique.mockResolvedValue(
      trainingWithRevisions([revisionRow(1, pastDate)]),
    );

    await trainingRevisionService.createRevision(
      { trainingId: 10, revisionLabel: "2024 Edition", effectiveDate: pastDate },
      "u1",
    );

    expect(mockEnqueue).toHaveBeenCalledWith("REQUIREMENTS_CACHE_REBUILD");
  });

  it("does not enqueue when the new revision is future-dated (not yet current)", async () => {
    mockPrisma.training.findUnique.mockResolvedValue(
      trainingWithRevisions([]),
    );
    mockPrisma.trainingRevision.create.mockResolvedValue(revisionRow(1, futureDate));

    await trainingRevisionService.createRevision(
      { trainingId: 10, revisionLabel: "Future", effectiveDate: futureDate },
      "u1",
    );

    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it("does not enqueue when retraining is not required (override = false)", async () => {
    const training = { id: 10, requiresRetrainingOnRevision: true, revisions: [] };
    mockPrisma.training.findUnique.mockResolvedValue(training);
    mockPrisma.trainingRevision.create.mockResolvedValue(
      revisionRow(1, pastDate, false),
    );

    await trainingRevisionService.createRevision(
      {
        trainingId: 10,
        revisionLabel: "No retrain",
        effectiveDate: pastDate,
        overrideRequiresRetraining: false,
      },
      "u1",
    );

    expect(mockEnqueue).not.toHaveBeenCalled();
  });
});

describe("trainingRevisionService.updateRevision", () => {
  it("updates a revision and writes a history row", async () => {
    mockPrisma.training.findUnique.mockResolvedValue(
      trainingWithRevisions([revisionRow(1, pastDate)]),
    );

    await trainingRevisionService.updateRevision(
      1,
      { revisionLabel: "Updated Edition" },
      "u1",
    );

    expect(mockPrisma.trainingRevision.update).toHaveBeenCalledOnce();
    expect(mockPrisma.history.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tableName: "TrainingRevision", action: "UPDATE" }),
      }),
    );
  });
});

describe("trainingRevisionService.deleteRevision", () => {
  it("deletes a revision with no stamped records", async () => {
    mockPrisma.trainingRevision.findUnique.mockResolvedValue({
      ...revisionRow(1, pastDate),
      records: [],
    });

    await trainingRevisionService.deleteRevision(1, "u1");

    expect(mockPrisma.trainingRevision.delete).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  it("throws REVISION_HAS_RECORDS when stamped records exist", async () => {
    mockPrisma.trainingRevision.findUnique.mockResolvedValue({
      ...revisionRow(1, pastDate),
      records: [{ id: 99 }],
    });

    await expect(trainingRevisionService.deleteRevision(1, "u1")).rejects.toThrow(
      "REVISION_HAS_RECORDS",
    );
    expect(mockPrisma.trainingRevision.delete).not.toHaveBeenCalled();
  });
});
