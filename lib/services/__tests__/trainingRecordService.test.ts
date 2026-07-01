import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    trainingRecords: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    training: {
      findUnique: vi.fn(),
    },
    history: {
      create: vi.fn(),
    },
  };
  return { mockPrisma };
});

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));
vi.mock("@/lib/jobs/jobQueue", () => ({ enqueue: vi.fn() }));
vi.mock("@/lib/services/fileUploadService", () => ({
  fileUploadService: { saveFiles: vi.fn().mockResolvedValue([]), deleteFiles: vi.fn() },
}));

// Suppress the auth import chain
vi.mock("@/lib/auth", () => ({ auth: {} }));
vi.mock("@/lib/apiRBAC", () => ({ getChildDepartmentIds: vi.fn() }));

import { trainingRecordService } from "@/lib/services/trainingRecordService";

const twoRevisions = [
  { id: 1, effectiveDate: new Date("2020-01-01"), createdAt: new Date("2020-01-01"), overrideRequiresRetraining: null },
  { id: 2, effectiveDate: new Date("2024-01-01"), createdAt: new Date("2024-01-01"), overrideRequiresRetraining: null },
];

const trainingWithRevisions = { id: 100, title: "Handbook", revisions: twoRevisions };
const createdRecord = { id: 9, employeeId: 1 };

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.trainingRecords.findFirst.mockResolvedValue(null);
  mockPrisma.training.findUnique.mockResolvedValue(trainingWithRevisions);
  mockPrisma.trainingRecords.create.mockResolvedValue(createdRecord);
  mockPrisma.trainingRecords.findUnique.mockResolvedValue({ id: 5, employeeId: 1, images: [] });
  mockPrisma.trainingRecords.update.mockResolvedValue({ id: 5, employeeId: 1 });
  mockPrisma.history.create.mockResolvedValue({});
});

describe("trainingRecordService.createTrainingRecord — revisionId", () => {
  it("stores the admin-selected revisionId verbatim", async () => {
    await trainingRecordService.createTrainingRecord(
      { employeeId: 1, trainingId: 100, dateCompleted: "2025-06-01", trainer: "T", revisionId: 1 },
      [],
      "u1",
    );

    expect(mockPrisma.trainingRecords.create.mock.calls[0][0].data.revisionId).toBe(1);
  });

  it("falls back to the revision current as of dateCompleted when revisionId is omitted", async () => {
    await trainingRecordService.createTrainingRecord(
      { employeeId: 1, trainingId: 100, dateCompleted: "2021-06-01", trainer: "T" },
      [],
      "u1",
    );

    // Rev 1 (effectiveDate 2020) is current as of 2021; rev 2 (effectiveDate 2024) is still future
    expect(mockPrisma.trainingRecords.create.mock.calls[0][0].data.revisionId).toBe(1);
  });

  it("stores null revisionId when the training has no revisions and none is supplied", async () => {
    mockPrisma.training.findUnique.mockResolvedValue({ id: 100, title: "Handbook", revisions: [] });

    await trainingRecordService.createTrainingRecord(
      { employeeId: 1, trainingId: 100, dateCompleted: "2025-06-01", trainer: "T" },
      [],
      "u1",
    );

    expect(mockPrisma.trainingRecords.create.mock.calls[0][0].data.revisionId).toBeNull();
  });

  it("throws INVALID_REVISION when the supplied revisionId does not belong to the training", async () => {
    await expect(
      trainingRecordService.createTrainingRecord(
        { employeeId: 1, trainingId: 100, dateCompleted: "2025-06-01", trainer: "T", revisionId: 999 },
        [],
        "u1",
      ),
    ).rejects.toThrow("INVALID_REVISION");
  });
});

describe("trainingRecordService.updateTrainingRecord — revisionId", () => {
  it("stores the admin-selected revisionId verbatim on update", async () => {
    await trainingRecordService.updateTrainingRecord(
      5,
      { employeeId: 1, trainingId: 100, dateCompleted: "2025-06-01", trainer: "T", revisionId: 2 },
      [],
      "u1",
    );

    expect(mockPrisma.trainingRecords.update.mock.calls[0][0].data.revisionId).toBe(2);
  });

  it("re-stamps to the as-of-date revision when revisionId is omitted", async () => {
    await trainingRecordService.updateTrainingRecord(
      5,
      { employeeId: 1, trainingId: 100, dateCompleted: "2021-06-01", trainer: "T" },
      [],
      "u1",
    );

    // Rev 1 is current as of 2021
    expect(mockPrisma.trainingRecords.update.mock.calls[0][0].data.revisionId).toBe(1);
  });

  it("throws INVALID_REVISION when the supplied revisionId does not belong to the training", async () => {
    await expect(
      trainingRecordService.updateTrainingRecord(
        5,
        { employeeId: 1, trainingId: 100, dateCompleted: "2025-06-01", trainer: "T", revisionId: 999 },
        [],
        "u1",
      ),
    ).rejects.toThrow("INVALID_REVISION");
  });
});
