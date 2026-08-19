import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    training: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    trainingRequirement: { create: vi.fn(), deleteMany: vi.fn() },
    sopAssessment: { groupBy: vi.fn() },
    history: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
  return { mockPrisma };
});

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));
vi.mock("@/lib/jobs/jobQueue", () => ({ enqueue: vi.fn() }));
vi.mock("@/lib/services/fileUploadService", () => ({
  fileUploadService: { deleteFile: vi.fn(), validateFile: vi.fn() },
}));

import { sopService } from "@/lib/services/sopService";

interface TrainingRowOverrides {
  id: number;
  title: string;
  isActive?: boolean;
  sopPartnerId?: number | null;
  revisions?: Array<{
    id: number;
    revisionLabel: string;
    effectiveDate: Date;
    createdAt: Date;
    overrideRequiresRetraining: boolean | null;
    documentPath: string | null;
    _count: { sopQuestions: number };
  }>;
  trainers?: Array<{ employeeId: number; hasAccount: boolean }>;
  requirements?: Array<{ departmentId: number; locationId: number }>;
  records?: number;
}

function trainingRow(o: TrainingRowOverrides) {
  return {
    id: o.id,
    title: o.title,
    category: "SOP",
    isActive: o.isActive ?? true,
    requiresRetrainingOnRevision: false,
    sopPartnerId: o.sopPartnerId ?? null,
    revisions: o.revisions ?? [],
    requirements: (o.requirements ?? []).map((req) => ({
      departmentId: req.departmentId,
      locationId: req.locationId,
      department: { name: `Dept ${req.departmentId}` },
      location: { name: `Loc ${req.locationId}` },
    })),
    sopTrainerAssignments: (o.trainers ?? []).map((t) => ({
      employeeId: t.employeeId,
      employee: {
        id: t.employeeId,
        legalFirstName: "Sam",
        legalLastName: `Trainer${t.employeeId}`,
        preferredFirstName: null,
        preferredLastName: null,
        User: t.hasAccount ? { id: `u${t.employeeId}` } : null,
      },
    })),
    _count: { trainingRecords: o.records ?? 0 },
  };
}

const readyRevision = {
  id: 10,
  revisionLabel: "2025 Edition",
  effectiveDate: new Date("2025-01-01"),
  createdAt: new Date("2025-01-01"),
  overrideRequiresRetraining: null,
  documentPath: "sop-documents/abc.pdf",
  _count: { sopQuestions: 4 },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.sopAssessment.groupBy.mockResolvedValue([]);
});

describe("listSops", () => {
  it("folds each pair into one row keyed on the Task Sheet", async () => {
    mockPrisma.training.findMany.mockResolvedValue([
      trainingRow({
        id: 1,
        title: "Pump Rebuild - Task Sheet",
        sopPartnerId: 2,
        revisions: [readyRevision],
        trainers: [{ employeeId: 7, hasAccount: true }],
        requirements: [{ departmentId: 3, locationId: 4 }],
        records: 9,
      }),
      trainingRow({ id: 2, title: "Pump Rebuild - Practical", records: 5 }),
    ]);

    const sops = await sopService.listSops();

    expect(sops).toHaveLength(1);
    expect(sops[0]).toMatchObject({
      taskSheetId: 1,
      practicalId: 2,
      title: "Pump Rebuild",
      paired: true,
      revisionCount: 1,
      // Reading the Task Sheet and being signed off on the Practical are
      // separate facts and must not be conflated.
      acknowledgements: 9,
      completions: 5,
      issues: [],
    });
    expect(sops[0].currentRevision).toMatchObject({
      id: 10,
      hasDocument: true,
      questionCount: 4,
    });
    expect(sops[0].requirements[0]).toMatchObject({
      departmentName: "Dept 3",
      locationName: "Loc 4",
    });
  });

  it("flags every gap that stops an SOP being takeable", async () => {
    mockPrisma.training.findMany.mockResolvedValue([
      trainingRow({
        id: 1,
        title: "Crane Check - Task Sheet",
        sopPartnerId: 2,
        revisions: [
          { ...readyRevision, documentPath: null, _count: { sopQuestions: 0 } },
        ],
      }),
      trainingRow({ id: 2, title: "Crane Check - Practical", isActive: false }),
    ]);

    const [sop] = await sopService.listSops();

    expect(sop.issues).toEqual([
      "No procedure PDF",
      "No questions",
      "No designated trainers",
      "Task Sheet and Practical differ in status",
    ]);
  });

  it("still lists an SOP whose halves were never linked", async () => {
    mockPrisma.training.findMany.mockResolvedValue([
      trainingRow({
        id: 1,
        title: "Orphan - Task Sheet",
        revisions: [readyRevision],
        trainers: [{ employeeId: 7, hasAccount: true }],
      }),
    ]);

    const [sop] = await sopService.listSops();

    expect(sop).toMatchObject({
      taskSheetId: 1,
      practicalId: null,
      paired: false,
      completions: 0,
    });
    expect(sop.issues).toContain("Not paired with a Practical");
  });

  it("counts assessments per SOP, ignoring superseded ones", async () => {
    mockPrisma.training.findMany.mockResolvedValue([
      trainingRow({
        id: 1,
        title: "Pump Rebuild - Task Sheet",
        sopPartnerId: 2,
        revisions: [readyRevision, { ...readyRevision, id: 11 }],
        trainers: [{ employeeId: 7, hasAccount: true }],
      }),
      trainingRow({ id: 2, title: "Pump Rebuild - Practical" }),
    ]);
    mockPrisma.sopAssessment.groupBy.mockResolvedValue([
      { revisionId: 10, status: "Submitted", _count: { _all: 2 } },
      { revisionId: 11, status: "Submitted", _count: { _all: 1 } },
      { revisionId: 10, status: "InProgress", _count: { _all: 3 } },
      { revisionId: 10, status: "Superseded", _count: { _all: 9 } },
      { revisionId: 99, status: "Passed", _count: { _all: 4 } }, // unknown revision
    ]);

    const [sop] = await sopService.listSops();

    expect(sop.assessments).toEqual({
      inProgress: 3,
      awaitingMarking: 3,
      changesRequested: 0,
      passed: 0,
    });
  });

  it("only counts a trainer login warning when nobody can mark", async () => {
    mockPrisma.training.findMany.mockResolvedValue([
      trainingRow({
        id: 1,
        title: "Pump Rebuild - Task Sheet",
        sopPartnerId: 2,
        revisions: [readyRevision],
        trainers: [{ employeeId: 7, hasAccount: false }],
      }),
      trainingRow({ id: 2, title: "Pump Rebuild - Practical" }),
    ]);

    const [sop] = await sopService.listSops();

    expect(sop.issues).toEqual(["No trainer has a login"]);
  });
});

describe("updatePair", () => {
  const pairedTaskSheet = {
    id: 1,
    sopPartnerId: 2,
    sopPartnerOf: null,
  };

  it("renames both halves with their own suffix and syncs shared fields", async () => {
    mockPrisma.training.findUnique.mockResolvedValue(pairedTaskSheet);
    mockPrisma.training.findMany
      .mockResolvedValueOnce([{ id: 1 }, { id: 2 }]) // `before` snapshot
      .mockResolvedValueOnce([
        trainingRow({ id: 1, title: "Pump Overhaul - Task Sheet", sopPartnerId: 2 }),
        trainingRow({ id: 2, title: "Pump Overhaul - Practical" }),
      ]);

    await sopService.updatePair(
      1,
      {
        title: "Pump Overhaul",
        isActive: false,
        requiresRetrainingOnRevision: true,
        requirements: [{ departmentId: 3, locationId: 4 }],
      },
      "u1",
    );

    expect(mockPrisma.training.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        isActive: false,
        requiresRetrainingOnRevision: true,
        title: "Pump Overhaul - Task Sheet",
      },
    });
    expect(mockPrisma.training.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: {
        isActive: false,
        requiresRetrainingOnRevision: true,
        title: "Pump Overhaul - Practical",
      },
    });
    // Requirements are replaced on both halves.
    expect(mockPrisma.trainingRequirement.deleteMany).toHaveBeenCalledWith({
      where: { trainingId: { in: [1, 2] } },
    });
    expect(mockPrisma.trainingRequirement.create).toHaveBeenCalledTimes(2);
  });

  it("strips a suffix the admin left in the name", async () => {
    mockPrisma.training.findUnique.mockResolvedValue(pairedTaskSheet);
    mockPrisma.training.findMany
      .mockResolvedValueOnce([{ id: 1 }, { id: 2 }])
      .mockResolvedValueOnce([
        trainingRow({ id: 1, title: "Pump Rebuild - Task Sheet", sopPartnerId: 2 }),
        trainingRow({ id: 2, title: "Pump Rebuild - Practical" }),
      ]);

    await sopService.updatePair(
      1,
      {
        title: "Pump Rebuild - Task Sheet",
        isActive: true,
        requiresRetrainingOnRevision: false,
      },
      "u1",
    );

    expect(mockPrisma.training.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 2 },
        data: expect.objectContaining({ title: "Pump Rebuild - Practical" }),
      }),
    );
  });

  it("refuses to write when the pair is not linked", async () => {
    mockPrisma.training.findUnique.mockResolvedValue({
      id: 1,
      sopPartnerId: null,
      sopPartnerOf: null,
    });

    await expect(
      sopService.updatePair(
        1,
        { title: "Orphan", isActive: true, requiresRetrainingOnRevision: false },
        "u1",
      ),
    ).rejects.toThrow("NOT_AN_SOP_PAIR");
    expect(mockPrisma.training.update).not.toHaveBeenCalled();
  });

  it("refuses to write from the Practical half", async () => {
    mockPrisma.training.findUnique.mockResolvedValue({
      id: 2,
      sopPartnerId: null,
      sopPartnerOf: { id: 1 },
    });

    await expect(
      sopService.updatePair(
        2,
        { title: "Pump", isActive: true, requiresRetrainingOnRevision: false },
        "u1",
      ),
    ).rejects.toThrow("NOT_A_TASK_SHEET");
    expect(mockPrisma.training.update).not.toHaveBeenCalled();
  });

  it("rejects a blank name before touching either half", async () => {
    mockPrisma.training.findUnique.mockResolvedValue(pairedTaskSheet);

    await expect(
      sopService.updatePair(
        1,
        { title: "   ", isActive: true, requiresRetrainingOnRevision: false },
        "u1",
      ),
    ).rejects.toThrow("TITLE_REQUIRED");
    expect(mockPrisma.training.update).not.toHaveBeenCalled();
  });
});
