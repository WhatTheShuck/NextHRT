import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    training: { findUnique: vi.fn(), update: vi.fn() },
    trainingRevision: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    sopQuestion: {
      findMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    sopAnswer: { count: vi.fn() },
    sopAssessment: { count: vi.fn() },
    // Guards the shared-file delete: how many *other* revisions still point at
    // a documentPath. Defaults to 0 (nothing else references it) per test.
    sopTrainerAssignment: { findMany: vi.fn(), createMany: vi.fn(), deleteMany: vi.fn() },
    history: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
  return { mockPrisma };
});

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));
vi.mock("@/lib/services/fileUploadService", () => ({
  fileUploadService: {
    saveFile: vi.fn(),
    deleteFile: vi.fn(),
    validateFile: vi.fn(),
  },
}));

// SOP documents are content-addressed on disk, so these tests drive real
// storage calls. Mock the filesystem rather than writing into uploads/.
vi.mock("fs/promises", () => ({
  mkdir: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));
vi.mock("fs", () => ({ existsSync: vi.fn(() => true) }));

import { createHash } from "crypto";
import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { sopService } from "@/lib/services/sopService";

/** The path the service will store `content` under. */
function hashedPath(content: string, extension = ".pdf") {
  const digest = createHash("sha256").update(Buffer.from(content)).digest("hex");
  return `sop-documents/${digest}${extension}`;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
  // No other revision shares the file unless a test says otherwise.
  mockPrisma.trainingRevision.count.mockResolvedValue(0);
  vi.mocked(existsSync).mockReturnValue(true);
});

function mockPairFromTaskSheet(taskSheetId = 1, practicalId = 2) {
  mockPrisma.training.findUnique.mockResolvedValue({
    id: taskSheetId,
    sopPartnerId: practicalId,
    sopPartnerOf: null,
  });
}

describe("resolvePair", () => {
  it("resolves from the Task Sheet side (holds the FK)", async () => {
    mockPairFromTaskSheet();
    expect(await sopService.resolvePair(1)).toEqual({ taskSheetId: 1, practicalId: 2 });
  });

  it("resolves from the Practical side via the inverse", async () => {
    mockPrisma.training.findUnique.mockResolvedValue({
      id: 2,
      sopPartnerId: null,
      sopPartnerOf: { id: 1 },
    });
    expect(await sopService.resolvePair(2)).toEqual({ taskSheetId: 1, practicalId: 2 });
  });

  it("returns null for an unlinked training", async () => {
    mockPrisma.training.findUnique.mockResolvedValue({
      id: 3,
      sopPartnerId: null,
      sopPartnerOf: null,
    });
    expect(await sopService.resolvePair(3)).toBeNull();
  });

  it("throws for a missing training", async () => {
    mockPrisma.training.findUnique.mockResolvedValue(null);
    await expect(sopService.resolvePair(99)).rejects.toThrow("TRAINING_NOT_FOUND");
  });
});

describe("replaceQuestions", () => {
  beforeEach(() => {
    mockPairFromTaskSheet();
    mockPrisma.trainingRevision.findUnique.mockResolvedValue({
      id: 10,
      trainingId: 1,
      documentPath: null,
    });
  });

  it("updates rows with an id, creates rows without, deletes missing rows", async () => {
    mockPrisma.sopQuestion.findMany
      .mockResolvedValueOnce([{ id: 100 }, { id: 101 }]) // existing
      .mockResolvedValueOnce([]); // re-list at end
    mockPrisma.sopAssessment.count.mockResolvedValue(0);

    await sopService.replaceQuestions(
      1,
      10,
      [
        { id: 100, order: 1, questionText: "Q1 updated" },
        { order: 2, questionText: "Q new" },
      ],
      "u1",
    );

    expect(mockPrisma.sopQuestion.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: [101] } },
    });
    expect(mockPrisma.sopQuestion.update).toHaveBeenCalledWith({
      where: { id: 100 },
      data: { order: 1, questionText: "Q1 updated", markerNotes: null },
    });
    expect(mockPrisma.sopQuestion.create).toHaveBeenCalledWith({
      data: { revisionId: 10, order: 2, questionText: "Q new", markerNotes: null },
    });
    expect(mockPrisma.history.create).toHaveBeenCalled();
  });

  it("blocks deleting an answered question with QUESTION_IN_USE", async () => {
    mockPrisma.sopQuestion.findMany.mockResolvedValueOnce([{ id: 100 }]);
    mockPrisma.sopAssessment.count.mockResolvedValue(3);

    await expect(sopService.replaceQuestions(1, 10, [], "u1")).rejects.toThrow(
      "QUESTION_IN_USE",
    );
    expect(mockPrisma.sopQuestion.deleteMany).not.toHaveBeenCalled();
  });

  it("rejects a revision that belongs to another training", async () => {
    mockPrisma.trainingRevision.findUnique.mockResolvedValue({
      id: 10,
      trainingId: 42,
      documentPath: null,
    });
    await expect(sopService.replaceQuestions(1, 10, [], "u1")).rejects.toThrow(
      "REVISION_NOT_FOUND",
    );
  });

  it("rejects the Practical half with NOT_A_TASK_SHEET", async () => {
    mockPrisma.training.findUnique.mockResolvedValue({
      id: 2,
      sopPartnerId: null,
      sopPartnerOf: { id: 1 },
    });
    await expect(sopService.replaceQuestions(2, 10, [], "u1")).rejects.toThrow(
      "NOT_A_TASK_SHEET",
    );
  });
});

describe("setTrainers", () => {
  it("keys assignments on the Task Sheet id even when given the Practical id", async () => {
    mockPrisma.training.findUnique.mockResolvedValue({
      id: 2,
      sopPartnerId: null,
      sopPartnerOf: { id: 1 },
    });
    mockPrisma.sopTrainerAssignment.findMany.mockResolvedValue([]);

    await sopService.setTrainers(2, [7, 8], "u1");

    expect(mockPrisma.sopTrainerAssignment.deleteMany).toHaveBeenCalledWith({
      where: { trainingId: 1 },
    });
    expect(mockPrisma.sopTrainerAssignment.createMany).toHaveBeenCalledWith({
      data: [
        { trainingId: 1, employeeId: 7 },
        { trainingId: 1, employeeId: 8 },
      ],
    });
  });
});

describe("uploadDocument", () => {
  it("rejects a training that is not the Task Sheet of a pair", async () => {
    mockPrisma.training.findUnique.mockResolvedValue({
      id: 2,
      sopPartnerId: null,
      sopPartnerOf: { id: 1 },
    });
    await expect(
      sopService.uploadDocument(
        2,
        10,
        new File(["%PDF"], "x.pdf", { type: "application/pdf" }),
        "u1",
      ),
    ).rejects.toThrow("NOT_A_TASK_SHEET");
  });

  it("stores the file under its hash, updates the revision, releases the old file, and logs history", async () => {
    mockPairFromTaskSheet();
    mockPrisma.trainingRevision.findUnique.mockResolvedValue({
      id: 10,
      trainingId: 1,
      documentPath: "sop-documents/old.pdf",
    });
    const { fileUploadService } = await import("@/lib/services/fileUploadService");
    vi.mocked(existsSync).mockImplementation((p) => !String(p).includes("new"));

    const file = new File(["%PDF-new"], "new.pdf", { type: "application/pdf" });
    const result = await sopService.uploadDocument(1, 10, file, "u1");

    const expected = hashedPath("%PDF-new");
    expect(mockPrisma.trainingRevision.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { documentPath: expected },
    });
    expect(fileUploadService.deleteFile).toHaveBeenCalledWith("sop-documents/old.pdf");
    expect(mockPrisma.history.create).toHaveBeenCalled();
    expect(result).toEqual({ documentPath: expected });
  });

  it("keeps the old file when another revision still references it", async () => {
    mockPairFromTaskSheet();
    mockPrisma.trainingRevision.findUnique.mockResolvedValue({
      id: 10,
      trainingId: 1,
      documentPath: "sop-documents/shared.pdf",
    });
    mockPrisma.trainingRevision.count.mockResolvedValue(2);
    const { fileUploadService } = await import("@/lib/services/fileUploadService");

    const file = new File(["%PDF-new"], "new.pdf", { type: "application/pdf" });
    await sopService.uploadDocument(1, 10, file, "u1");

    expect(mockPrisma.trainingRevision.count).toHaveBeenCalledWith({
      where: { documentPath: "sop-documents/shared.pdf", id: { not: 10 } },
    });
    expect(fileUploadService.deleteFile).not.toHaveBeenCalled();
  });

  it("does not rewrite or delete anything when the same bytes are re-uploaded", async () => {
    mockPairFromTaskSheet();
    const existing = hashedPath("%PDF-same");
    mockPrisma.trainingRevision.findUnique.mockResolvedValue({
      id: 10,
      trainingId: 1,
      documentPath: existing,
    });
    const { fileUploadService } = await import("@/lib/services/fileUploadService");

    const file = new File(["%PDF-same"], "same.pdf", { type: "application/pdf" });
    const result = await sopService.uploadDocument(1, 10, file, "u1");

    expect(result).toEqual({ documentPath: existing });
    // The hash-named file is already on disk, and it is still this revision's.
    expect(writeFile).not.toHaveBeenCalled();
    expect(fileUploadService.deleteFile).not.toHaveBeenCalled();
  });

  it("rejects a non-PDF file with INVALID_FILE_TYPE and does not save it", async () => {
    mockPairFromTaskSheet();
    mockPrisma.trainingRevision.findUnique.mockResolvedValue({
      id: 10,
      trainingId: 1,
      documentPath: null,
    });

    const file = new File(["notpdf"], "x.png", { type: "image/png" });
    await expect(sopService.uploadDocument(1, 10, file, "u1")).rejects.toThrow(
      "INVALID_FILE_TYPE",
    );
    expect(writeFile).not.toHaveBeenCalled();
  });
});

describe("deleteDocument", () => {
  it("clears the documentPath, deletes the file, and logs history when one is set", async () => {
    mockPairFromTaskSheet();
    mockPrisma.trainingRevision.findUnique.mockResolvedValue({
      id: 10,
      trainingId: 1,
      documentPath: "sop-documents/old.pdf",
    });
    const { fileUploadService } = await import("@/lib/services/fileUploadService");

    await sopService.deleteDocument(1, 10, "u1");

    expect(mockPrisma.trainingRevision.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { documentPath: null },
    });
    expect(fileUploadService.deleteFile).toHaveBeenCalledWith("sop-documents/old.pdf");
    expect(mockPrisma.history.create).toHaveBeenCalled();
  });

  it("clears the documentPath but keeps the file when another revision shares it", async () => {
    mockPairFromTaskSheet();
    mockPrisma.trainingRevision.findUnique.mockResolvedValue({
      id: 10,
      trainingId: 1,
      documentPath: "sop-documents/shared.pdf",
    });
    mockPrisma.trainingRevision.count.mockResolvedValue(1);
    const { fileUploadService } = await import("@/lib/services/fileUploadService");

    await sopService.deleteDocument(1, 10, "u1");

    expect(mockPrisma.trainingRevision.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { documentPath: null },
    });
    expect(fileUploadService.deleteFile).not.toHaveBeenCalled();
  });

  it("does nothing when there is no documentPath set", async () => {
    mockPairFromTaskSheet();
    mockPrisma.trainingRevision.findUnique.mockResolvedValue({
      id: 10,
      trainingId: 1,
      documentPath: null,
    });
    const { fileUploadService } = await import("@/lib/services/fileUploadService");

    await sopService.deleteDocument(1, 10, "u1");

    expect(mockPrisma.trainingRevision.update).not.toHaveBeenCalled();
    expect(fileUploadService.deleteFile).not.toHaveBeenCalled();
    expect(mockPrisma.history.create).not.toHaveBeenCalled();
  });
});

describe("revisionHasSubmissions", () => {
  it("counts only assessments that were ever submitted", async () => {
    mockPrisma.sopAssessment.count.mockResolvedValue(2);
    expect(await sopService.revisionHasSubmissions(10)).toBe(true);
    expect(mockPrisma.sopAssessment.count).toHaveBeenCalledWith({
      where: { revisionId: 10, submittedAt: { not: null } },
    });
  });
});

describe("copyForward", () => {
  it("is a no-op for a training that is not a Task Sheet", async () => {
    mockPrisma.training.findUnique.mockResolvedValue({
      id: 2,
      sopPartnerId: null,
      sopPartnerOf: { id: 1 },
    });
    await sopService.copyForward(2, 20);
    expect(mockPrisma.trainingRevision.findMany).not.toHaveBeenCalled();
  });

  it("copies questions from the previously-current revision", async () => {
    mockPairFromTaskSheet();
    const old = new Date("2025-01-01");
    mockPrisma.trainingRevision.findMany.mockResolvedValue([
      { id: 10, effectiveDate: old, createdAt: old, overrideRequiresRetraining: null },
    ]);
    mockPrisma.trainingRevision.findUnique.mockResolvedValue({
      documentPath: null,
      sopQuestions: [
        { order: 1, questionText: "Q1", markerNotes: "look for X" },
        { order: 2, questionText: "Q2", markerNotes: null },
      ],
    });

    await sopService.copyForward(1, 20);

    expect(mockPrisma.sopQuestion.createMany).toHaveBeenCalledWith({
      data: [
        { revisionId: 20, order: 1, questionText: "Q1", markerNotes: "look for X" },
        { revisionId: 20, order: 2, questionText: "Q2", markerNotes: null },
      ],
    });
  });

  it("carries an already content-addressed document forward without writing a copy", async () => {
    mockPairFromTaskSheet();
    const old = new Date("2025-01-01");
    const shared = hashedPath("%PDF-body");
    mockPrisma.trainingRevision.findMany.mockResolvedValue([
      { id: 10, effectiveDate: old, createdAt: old, overrideRequiresRetraining: null },
    ]);
    mockPrisma.trainingRevision.findUnique.mockResolvedValue({
      documentPath: shared,
      sopQuestions: [],
    });
    vi.mocked(readFile).mockResolvedValue(Buffer.from("%PDF-body") as any);

    await sopService.copyForward(1, 20);

    // Both revisions end up on the one file — no second copy on disk.
    expect(writeFile).not.toHaveBeenCalled();
    expect(mockPrisma.trainingRevision.update).toHaveBeenCalledWith({
      where: { id: 20 },
      data: { documentPath: shared },
    });
  });

  it("rewrites a legacy UUID-named document under its hash on first carry-forward", async () => {
    mockPairFromTaskSheet();
    const old = new Date("2025-01-01");
    mockPrisma.trainingRevision.findMany.mockResolvedValue([
      { id: 10, effectiveDate: old, createdAt: old, overrideRequiresRetraining: null },
    ]);
    mockPrisma.trainingRevision.findUnique.mockResolvedValue({
      documentPath: "sop-documents/3076db75-fa04-4693-b16d-58eb39a99e46.pdf",
      sopQuestions: [],
    });
    vi.mocked(readFile).mockResolvedValue(Buffer.from("%PDF-legacy") as any);
    vi.mocked(existsSync).mockImplementation((p) => !String(p).includes(".pdf"));

    await sopService.copyForward(1, 20);

    expect(writeFile).toHaveBeenCalledTimes(1);
    expect(mockPrisma.trainingRevision.update).toHaveBeenCalledWith({
      where: { id: 20 },
      data: { documentPath: hashedPath("%PDF-legacy") },
    });
  });

  it("is a no-op when there is no earlier current revision", async () => {
    mockPairFromTaskSheet();
    mockPrisma.trainingRevision.findMany.mockResolvedValue([]);
    await sopService.copyForward(1, 20);
    expect(mockPrisma.sopQuestion.createMany).not.toHaveBeenCalled();
  });
});
