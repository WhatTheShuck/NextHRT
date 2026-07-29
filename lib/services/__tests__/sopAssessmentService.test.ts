import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    user: { findUnique: vi.fn(), findMany: vi.fn() },
    employee: { findUnique: vi.fn() },
    training: { findUnique: vi.fn() },
    trainingRequirement: { findMany: vi.fn() },
    trainingRevision: { findMany: vi.fn(), findUnique: vi.fn() },
    trainingRecords: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    sopQuestion: { count: vi.fn(), findMany: vi.fn() },
    sopAnswer: { upsert: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    sopAssessment: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    sopTrainerAssignment: { findMany: vi.fn(), findUnique: vi.fn() },
    history: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
  return { mockPrisma };
});

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));
vi.mock("@/lib/services/mailService", () => ({
  mailService: { send: vi.fn() },
}));
vi.mock("@/lib/services/emailTemplateService", () => ({
  emailTemplateService: {
    render: vi.fn().mockResolvedValue({ subject: "s", body: "b" }),
  },
}));

import { sopAssessmentService } from "@/lib/services/sopAssessmentService";
import { mailService } from "@/lib/services/mailService";
import { emailTemplateService } from "@/lib/services/emailTemplateService";

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
});

/** Session user u1 is linked to employee 50. */
function mockLinkedEmployee(employeeId: number | null = 50) {
  mockPrisma.user.findUnique.mockResolvedValue(
    employeeId === null ? { employeeId: null } : { employeeId, name: "Terry Trainer" },
  );
}

/** listMine scaffolding: no records, no active assessment, revision 10 ready. */
function mockReadySop() {
  mockPrisma.trainingRecords.findMany.mockResolvedValue([]);
  mockPrisma.sopAssessment.findMany.mockResolvedValue([]);
  const eff = new Date("2025-01-01");
  mockPrisma.trainingRevision.findMany.mockResolvedValue([
    { id: 10, effectiveDate: eff, createdAt: eff, overrideRequiresRetraining: null },
  ]);
  mockPrisma.trainingRevision.findUnique.mockResolvedValue({
    documentPath: "sop-documents/a.pdf",
  });
  mockPrisma.sopQuestion.count.mockResolvedValue(2);
}

/** Training 1 (Task Sheet, partner 2) with revision 10 current, ready to take. */
function mockReadyTaskSheet() {
  mockPrisma.training.findUnique.mockResolvedValue({
    id: 1,
    sopPartnerId: 2,
    sopPartnerOf: null,
  });
  const eff = new Date("2025-01-01");
  mockPrisma.trainingRevision.findMany.mockResolvedValue([
    { id: 10, effectiveDate: eff, createdAt: eff, overrideRequiresRetraining: null },
  ]);
  mockPrisma.trainingRevision.findUnique.mockResolvedValue({
    id: 10,
    trainingId: 1,
    documentPath: "sop-documents/a.pdf",
  });
  mockPrisma.sopQuestion.count.mockResolvedValue(4);
  // Fresh SOP: no existing non-terminal assessment unless a test overrides.
  // (vitest clearMocks clears call history but not implementations, so a
  // leftover mockResolvedValue would otherwise leak between tests.)
  mockPrisma.sopAssessment.findFirst.mockResolvedValue(null);
}

describe("start", () => {
  it("creates an InProgress assessment pinned to the current Task Sheet revision", async () => {
    mockLinkedEmployee();
    mockReadyTaskSheet();
    mockPrisma.sopAssessment.findFirst.mockResolvedValue(null);
    mockPrisma.sopAssessment.create.mockResolvedValue({ id: 500, status: "InProgress" });

    const result = await sopAssessmentService.start("u1", 1);

    expect(mockPrisma.sopAssessment.create).toHaveBeenCalledWith({
      data: { employeeId: 50, revisionId: 10, status: "InProgress" },
    });
    expect(result).toEqual({ id: 500, status: "InProgress" });
    expect(mockPrisma.history.create).toHaveBeenCalled();
  });

  it("returns the existing non-terminal assessment instead of creating a second", async () => {
    mockLinkedEmployee();
    mockReadyTaskSheet();
    mockPrisma.sopAssessment.findFirst.mockResolvedValue({ id: 400, status: "Submitted" });

    const result = await sopAssessmentService.start("u1", 1);

    expect(result).toEqual({ id: 400, status: "Submitted" });
    expect(mockPrisma.sopAssessment.create).not.toHaveBeenCalled();
  });

  it("throws SOP_NOT_READY when the current revision has no document", async () => {
    mockLinkedEmployee();
    mockReadyTaskSheet();
    mockPrisma.trainingRevision.findUnique.mockResolvedValue({
      id: 10,
      trainingId: 1,
      documentPath: null,
    });
    await expect(sopAssessmentService.start("u1", 1)).rejects.toThrow("SOP_NOT_READY");
  });

  it("throws SOP_NOT_READY when the current revision has no questions", async () => {
    mockLinkedEmployee();
    mockReadyTaskSheet();
    mockPrisma.sopQuestion.count.mockResolvedValue(0);
    await expect(sopAssessmentService.start("u1", 1)).rejects.toThrow("SOP_NOT_READY");
  });

  it("throws NO_LINKED_EMPLOYEE for a user without a linked employee", async () => {
    mockLinkedEmployee(null);
    await expect(sopAssessmentService.start("u1", 1)).rejects.toThrow("NO_LINKED_EMPLOYEE");
  });

  it("throws NOT_A_TASK_SHEET when given the Practical half", async () => {
    mockLinkedEmployee();
    mockPrisma.training.findUnique.mockResolvedValue({
      id: 2,
      sopPartnerId: null,
      sopPartnerOf: { id: 1 },
    });
    await expect(sopAssessmentService.start("u1", 2)).rejects.toThrow("NOT_A_TASK_SHEET");
  });
});

describe("restart", () => {
  it("supersedes the old assessment and starts a new one on the current revision", async () => {
    mockLinkedEmployee();
    mockPrisma.sopAssessment.findUnique.mockResolvedValue({
      id: 400,
      employeeId: 50,
      status: "InProgress",
      revisionId: 9,
      taskSheetRecordId: null,
      revision: { trainingId: 1 },
    });
    mockReadyTaskSheet();
    mockPrisma.sopAssessment.create.mockResolvedValue({ id: 501, status: "InProgress" });

    const result = await sopAssessmentService.restart(400, "u1");

    expect(mockPrisma.sopAssessment.update).toHaveBeenCalledWith({
      where: { id: 400 },
      data: { status: "Superseded", taskSheetRecordId: null },
    });
    expect(mockPrisma.sopAssessment.create).toHaveBeenCalledWith({
      data: {
        employeeId: 50,
        revisionId: 10,
        status: "InProgress",
        taskSheetRecordId: null,
      },
    });
    expect(result).toEqual({ id: 501, status: "InProgress" });
  });

  it("releases the record link so the new assessment can re-acknowledge same-day", async () => {
    // taskSheetRecordId is @unique — the superseded row must release it in
    // the same transaction, or the new assessment's acknowledge (which
    // find-or-reuses the same-day record) would trip P2002.
    mockLinkedEmployee();
    mockPrisma.sopAssessment.findUnique.mockResolvedValue({
      id: 400,
      employeeId: 50,
      status: "ChangesRequested",
      revisionId: 9,
      taskSheetRecordId: 900,
      revision: { trainingId: 1 },
    });
    mockReadyTaskSheet();
    mockPrisma.sopAssessment.create.mockResolvedValue({ id: 501, status: "InProgress" });

    await sopAssessmentService.restart(400, "u1");

    expect(mockPrisma.sopAssessment.update).toHaveBeenCalledWith({
      where: { id: 400 },
      data: { status: "Superseded", taskSheetRecordId: null },
    });
    // the new assessment does NOT inherit the record — the employee must
    // re-read (and re-acknowledge) the procedure on the current revision
    expect(mockPrisma.sopAssessment.create).toHaveBeenCalledWith({
      data: {
        employeeId: 50,
        revisionId: 10,
        status: "InProgress",
        taskSheetRecordId: null,
      },
    });
  });

  it("rejects restart by a non-owner", async () => {
    mockLinkedEmployee(51);
    mockPrisma.sopAssessment.findUnique.mockResolvedValue({
      id: 400,
      employeeId: 50,
      status: "InProgress",
      revisionId: 9,
      revision: { trainingId: 1 },
    });
    await expect(sopAssessmentService.restart(400, "u1")).rejects.toThrow("NOT_AUTHORISED");
  });

  it("rejects restart of a terminal assessment", async () => {
    mockLinkedEmployee();
    mockPrisma.sopAssessment.findUnique.mockResolvedValue({
      id: 400,
      employeeId: 50,
      status: "Passed",
      revisionId: 9,
      revision: { trainingId: 1 },
    });
    await expect(sopAssessmentService.restart(400, "u1")).rejects.toThrow("INVALID_STATE");
  });
});

/** An owned assessment in the given state, on revision 10 / training 1. */
function mockOwnedAssessment(status: string, extra: Record<string, unknown> = {}) {
  mockLinkedEmployee();
  mockPrisma.sopAssessment.findUnique.mockResolvedValue({
    id: 400,
    employeeId: 50,
    revisionId: 10,
    status,
    taskSheetRecordId: null,
    practicalRecordId: null,
    revision: { trainingId: 1 },
    ...extra,
  });
}

describe("saveAnswers", () => {
  it("upserts answers freely while InProgress", async () => {
    mockOwnedAssessment("InProgress");
    mockPrisma.sopQuestion.findMany.mockResolvedValue([{ id: 100 }, { id: 101 }]);
    mockPrisma.sopAnswer.findMany.mockResolvedValue([]);

    await sopAssessmentService.saveAnswers(400, "u1", [
      { questionId: 100, answerText: "First answer" },
    ]);

    expect(mockPrisma.sopAnswer.upsert).toHaveBeenCalledWith({
      where: { assessmentId_questionId: { assessmentId: 400, questionId: 100 } },
      create: { assessmentId: 400, questionId: 100, answerText: "First answer" },
      update: { answerText: "First answer", verdict: null, trainerComment: null },
    });
  });

  it("rejects an answer for a question outside the pinned revision", async () => {
    mockOwnedAssessment("InProgress");
    mockPrisma.sopQuestion.findMany.mockResolvedValue([{ id: 100 }]);
    mockPrisma.sopAnswer.findMany.mockResolvedValue([]);

    await expect(
      sopAssessmentService.saveAnswers(400, "u1", [
        { questionId: 999, answerText: "sneaky" },
      ]),
    ).rejects.toThrow("INVALID_QUESTION");
  });

  it("in ChangesRequested, only insufficient answers are editable", async () => {
    mockOwnedAssessment("ChangesRequested");
    mockPrisma.sopQuestion.findMany.mockResolvedValue([{ id: 100 }, { id: 101 }]);
    mockPrisma.sopAnswer.findMany.mockResolvedValue([
      { questionId: 100, verdict: "Sufficient" },
      { questionId: 101, verdict: "Insufficient" },
    ]);

    await expect(
      sopAssessmentService.saveAnswers(400, "u1", [
        { questionId: 100, answerText: "editing a sufficient answer" },
      ]),
    ).rejects.toThrow("ANSWER_LOCKED");

    await sopAssessmentService.saveAnswers(400, "u1", [
      { questionId: 101, answerText: "fixed" },
    ]);
    // editing clears the verdict + comment
    expect(mockPrisma.sopAnswer.upsert).toHaveBeenCalledWith({
      where: { assessmentId_questionId: { assessmentId: 400, questionId: 101 } },
      create: { assessmentId: 400, questionId: 101, answerText: "fixed" },
      update: { answerText: "fixed", verdict: null, trainerComment: null },
    });
  });

  it("rejects saving in a Submitted assessment", async () => {
    mockOwnedAssessment("Submitted");
    await expect(
      sopAssessmentService.saveAnswers(400, "u1", [
        { questionId: 100, answerText: "x" },
      ]),
    ).rejects.toThrow("INVALID_STATE");
  });

  it("rejects a non-owner", async () => {
    mockLinkedEmployee(51);
    mockPrisma.sopAssessment.findUnique.mockResolvedValue({
      id: 400,
      employeeId: 50,
      status: "InProgress",
      revision: { trainingId: 1 },
    });
    await expect(
      sopAssessmentService.saveAnswers(400, "u1", []),
    ).rejects.toThrow("NOT_AUTHORISED");
  });
});

describe("acknowledgeRead", () => {
  it("creates the Task Sheet record stamped with the pinned revision", async () => {
    mockOwnedAssessment("InProgress");
    mockPrisma.trainingRecords.findFirst.mockResolvedValue(null);
    mockPrisma.trainingRecords.create.mockResolvedValue({ id: 900 });

    await sopAssessmentService.acknowledgeRead(400, "u1");

    const createArg = mockPrisma.trainingRecords.create.mock.calls[0][0];
    expect(createArg.data.employeeId).toBe(50);
    expect(createArg.data.trainingId).toBe(1);
    expect(createArg.data.revisionId).toBe(10);
    expect(createArg.data.trainer).toBe("Self-acknowledged (HRT)");
    // normalised to local midnight
    expect(createArg.data.dateCompleted.getHours()).toBe(0);
    expect(mockPrisma.sopAssessment.update).toHaveBeenCalledWith({
      where: { id: 400 },
      data: { taskSheetRecordId: 900 },
    });
  });

  it("is idempotent — a second acknowledge is a no-op", async () => {
    mockOwnedAssessment("InProgress", { taskSheetRecordId: 900 });

    await sopAssessmentService.acknowledgeRead(400, "u1");

    expect(mockPrisma.trainingRecords.create).not.toHaveBeenCalled();
    expect(mockPrisma.sopAssessment.update).not.toHaveBeenCalled();
  });

  it("reuses an existing same-day record instead of tripping the unique constraint", async () => {
    mockOwnedAssessment("InProgress");
    mockPrisma.trainingRecords.findFirst.mockResolvedValue({
      id: 901,
      trainer: "Jane Admin",
      revisionId: 10,
    });

    await sopAssessmentService.acknowledgeRead(400, "u1");

    expect(mockPrisma.trainingRecords.create).not.toHaveBeenCalled();
    expect(mockPrisma.trainingRecords.update).not.toHaveBeenCalled();
    expect(mockPrisma.sopAssessment.update).toHaveBeenCalledWith({
      where: { id: 400 },
      data: { taskSheetRecordId: 901 },
    });
  });

  it("re-stamps a reused self-acknowledged record with the pinned revision (post-restart)", async () => {
    // Restart scenario: the same-day record was created by the superseded
    // assessment on the old revision. It is our own self-ack record, so the
    // revision stamp moves to the revision the employee actually re-read.
    mockOwnedAssessment("InProgress");
    mockPrisma.trainingRecords.findFirst.mockResolvedValue({
      id: 901,
      trainer: "Self-acknowledged (HRT)",
      revisionId: 9,
    });
    mockPrisma.trainingRecords.update.mockResolvedValue({
      id: 901,
      trainer: "Self-acknowledged (HRT)",
      revisionId: 10,
    });

    await sopAssessmentService.acknowledgeRead(400, "u1");

    expect(mockPrisma.trainingRecords.update).toHaveBeenCalledWith({
      where: { id: 901 },
      data: { revisionId: 10 },
    });
    expect(mockPrisma.sopAssessment.update).toHaveBeenCalledWith({
      where: { id: 400 },
      data: { taskSheetRecordId: 901 },
    });
  });

  it("releases another assessment's link on the reused record before claiming it", async () => {
    // Same-day re-take after a terminal assessment: a Passed assessment owns a
    // same-day self-ack record R on the OLD revision (taskSheetRecordId @unique).
    // A new Task Sheet revision is published the same day, so the employee starts
    // fresh → assessment 400 on the NEW revision. acknowledgeRead finds R via the
    // same-day find-or-reuse; without releasing the terminal link first, setting
    // taskSheetRecordId on 400 would trip P2002. The terminal assessment keeps its
    // record only as historical evidence — releasing it is safe.
    mockOwnedAssessment("InProgress");
    mockPrisma.trainingRecords.findFirst.mockResolvedValue({
      id: 901,
      trainer: "Self-acknowledged (HRT)",
      revisionId: 9,
    });
    mockPrisma.trainingRecords.update.mockResolvedValue({
      id: 901,
      trainer: "Self-acknowledged (HRT)",
      revisionId: 10,
    });

    await sopAssessmentService.acknowledgeRead(400, "u1");

    expect(mockPrisma.sopAssessment.updateMany).toHaveBeenCalledWith({
      where: { taskSheetRecordId: 901, id: { not: 400 } },
      data: { taskSheetRecordId: null },
    });
    expect(mockPrisma.sopAssessment.update).toHaveBeenCalledWith({
      where: { id: 400 },
      data: { taskSheetRecordId: 901 },
    });
  });

  it("rejects acknowledging a terminal assessment", async () => {
    mockOwnedAssessment("Superseded");
    await expect(sopAssessmentService.acknowledgeRead(400, "u1")).rejects.toThrow(
      "INVALID_STATE",
    );
  });
});

describe("submit", () => {
  function mockAnswersComplete() {
    mockPrisma.sopQuestion.findMany.mockResolvedValue([{ id: 100 }, { id: 101 }]);
    mockPrisma.sopAnswer.findMany.mockResolvedValue([
      { questionId: 100, answerText: "a1" },
      { questionId: 101, answerText: "a2" },
    ]);
  }

  function mockNotificationLookups(trainerEmails: Array<string | null>) {
    mockPrisma.sopTrainerAssignment.findMany.mockResolvedValue(
      trainerEmails.map((email, i) => ({
        employeeId: 70 + i,
        employee: {
          preferredFirstName: null,
          legalFirstName: "T",
          legalLastName: `${i}`,
          User: email === null ? null : { email },
        },
      })),
    );
    mockPrisma.training.findUnique.mockResolvedValue({
      id: 1,
      title: "Pump Rebuild - Task Sheet",
      sopPartnerId: 2,
      sopPartnerOf: null,
    });
    mockPrisma.employee.findUnique.mockResolvedValue({
      preferredFirstName: null,
      legalFirstName: "Erin",
      legalLastName: "Employee",
    });
  }

  it("moves to Submitted and emails designated trainers with linked accounts", async () => {
    mockOwnedAssessment("InProgress");
    mockAnswersComplete();
    mockNotificationLookups(["t1@ksb.com", null, "t2@ksb.com"]);

    await sopAssessmentService.submit(400, "u1");

    expect(mockPrisma.sopAssessment.update).toHaveBeenCalledWith({
      where: { id: 400 },
      data: { status: "Submitted", submittedAt: expect.any(Date) },
    });
    expect(vi.mocked(mailService.send)).toHaveBeenCalledWith(
      expect.objectContaining({ to: ["t1@ksb.com", "t2@ksb.com"] }),
    );
  });

  it("falls back to Admin users when no designated trainer is reachable", async () => {
    mockOwnedAssessment("InProgress");
    mockAnswersComplete();
    mockNotificationLookups([null]);
    mockPrisma.user.findMany.mockResolvedValue([
      { email: "admin@ksb.com" },
    ]);

    await sopAssessmentService.submit(400, "u1");

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
      where: { role: "Admin", email: { not: null } },
      select: { email: true },
    });
    expect(vi.mocked(mailService.send)).toHaveBeenCalledWith(
      expect.objectContaining({ to: ["admin@ksb.com"] }),
    );
  });

  it("rejects submit while any question is unanswered", async () => {
    mockOwnedAssessment("InProgress");
    mockPrisma.sopQuestion.findMany.mockResolvedValue([{ id: 100 }, { id: 101 }]);
    mockPrisma.sopAnswer.findMany.mockResolvedValue([
      { questionId: 100, answerText: "a1" },
      { questionId: 101, answerText: "   " },
    ]);

    await expect(sopAssessmentService.submit(400, "u1")).rejects.toThrow(
      "INCOMPLETE_ANSWERS",
    );
  });

  it("rejects submit from Submitted (no double submit)", async () => {
    mockOwnedAssessment("Submitted");
    await expect(sopAssessmentService.submit(400, "u1")).rejects.toThrow("INVALID_STATE");
  });

  it("still commits Submitted when the notification path throws", async () => {
    // Delivery is best-effort — a failure to render/enqueue the trainer email
    // must not roll the caller back onto an already-committed transition, or a
    // retry would hit INVALID_STATE and strand the assessment.
    mockOwnedAssessment("InProgress");
    mockAnswersComplete();
    mockNotificationLookups(["t1@ksb.com"]);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(emailTemplateService.render).mockRejectedValueOnce(new Error("smtp down"));

    await expect(sopAssessmentService.submit(400, "u1")).resolves.toBeUndefined();

    expect(mockPrisma.sopAssessment.update).toHaveBeenCalledWith({
      where: { id: 400 },
      data: { status: "Submitted", submittedAt: expect.any(Date) },
    });
  });
});

describe("mark", () => {
  function mockSubmittedAssessment() {
    mockPrisma.sopAssessment.findUnique.mockResolvedValue({
      id: 400,
      employeeId: 50,
      revisionId: 10,
      status: "Submitted",
      taskSheetRecordId: 900,
      practicalRecordId: null,
      revision: { trainingId: 1 },
    });
    // marker u9 linked to employee 70, designated trainer for training 1
    mockPrisma.user.findUnique.mockResolvedValue({
      employeeId: 70,
      name: "Terry Trainer",
    });
    mockPrisma.sopTrainerAssignment.findUnique.mockResolvedValue({
      trainingId: 1,
      employeeId: 70,
    });
    mockPrisma.training.findUnique.mockResolvedValue({
      id: 1,
      title: "Pump Rebuild - Task Sheet",
      sopPartnerId: 2,
      sopPartnerOf: null,
    });
    mockPrisma.employee.findUnique.mockResolvedValue({
      preferredFirstName: null,
      legalFirstName: "Erin",
      preferredLastName: null,
      legalLastName: "Employee",
      User: { email: "erin@ksb.com" },
    });
  }

  it("pass: applies verdicts, creates the Practical record, emails the employee", async () => {
    mockSubmittedAssessment();
    mockPrisma.sopAnswer.findMany.mockResolvedValue([
      { id: 601, questionId: 100, verdict: "Sufficient" },
      { id: 602, questionId: 101, verdict: "Sufficient" },
    ]);
    const eff = new Date("2025-01-01");
    mockPrisma.trainingRevision.findMany.mockResolvedValue([
      { id: 30, effectiveDate: eff, createdAt: eff, overrideRequiresRetraining: null },
    ]);
    mockPrisma.trainingRecords.findFirst.mockResolvedValue(null);
    mockPrisma.trainingRecords.create.mockResolvedValue({ id: 950 });

    await sopAssessmentService.mark(400, "u9", "Trainer", {
      action: "pass",
      verdicts: [
        { answerId: 601, verdict: "Sufficient" },
        { answerId: 602, verdict: "Sufficient" },
      ],
    });

    const recordArg = mockPrisma.trainingRecords.create.mock.calls[0][0];
    expect(recordArg.data.trainingId).toBe(2); // the Practical half
    expect(recordArg.data.revisionId).toBe(30); // current Practical revision
    expect(recordArg.data.trainer).toBe("Terry Trainer");
    expect(mockPrisma.sopAssessment.update).toHaveBeenCalledWith({
      where: { id: 400 },
      data: expect.objectContaining({
        status: "Passed",
        markedByUserId: "u9",
        practicalRecordId: 950,
      }),
    });
    expect(vi.mocked(mailService.send)).toHaveBeenCalledWith(
      expect.objectContaining({ to: "erin@ksb.com" }),
    );
  });

  it("pass with any Insufficient verdict is rejected", async () => {
    mockSubmittedAssessment();
    mockPrisma.sopAnswer.findMany.mockResolvedValue([
      { id: 601, questionId: 100, verdict: "Sufficient" },
      { id: 602, questionId: 101, verdict: "Insufficient" },
    ]);

    await expect(
      sopAssessmentService.mark(400, "u9", "Trainer", {
        action: "pass",
        verdicts: [{ answerId: 602, verdict: "Insufficient" }],
      }),
    ).rejects.toThrow("VERDICT_MISMATCH");
  });

  it("requestChanges requires at least one Insufficient", async () => {
    mockSubmittedAssessment();
    mockPrisma.sopAnswer.findMany.mockResolvedValue([
      { id: 601, questionId: 100, verdict: "Sufficient" },
      { id: 602, questionId: 101, verdict: "Sufficient" },
    ]);

    await expect(
      sopAssessmentService.mark(400, "u9", "Trainer", {
        action: "requestChanges",
        verdicts: [],
      }),
    ).rejects.toThrow("VERDICT_MISMATCH");
  });

  it("rejects marking while any answer is unmarked", async () => {
    mockSubmittedAssessment();
    mockPrisma.sopAnswer.findMany.mockResolvedValue([
      { id: 601, questionId: 100, verdict: "Sufficient" },
      { id: 602, questionId: 101, verdict: null },
    ]);

    await expect(
      sopAssessmentService.mark(400, "u9", "Trainer", {
        action: "pass",
        verdicts: [],
      }),
    ).rejects.toThrow("MISSING_VERDICTS");
  });

  it("requestChanges: saves comments and flips to ChangesRequested", async () => {
    mockSubmittedAssessment();
    mockPrisma.sopAnswer.findMany.mockResolvedValue([
      { id: 601, questionId: 100, verdict: "Sufficient" },
      { id: 602, questionId: 101, verdict: "Insufficient" },
    ]);

    await sopAssessmentService.mark(400, "u9", "Trainer", {
      action: "requestChanges",
      verdicts: [
        { answerId: 602, verdict: "Insufficient", trainerComment: "cite the lockout step" },
      ],
    });

    expect(mockPrisma.sopAnswer.update).toHaveBeenCalledWith({
      where: { id: 602 },
      data: { verdict: "Insufficient", trainerComment: "cite the lockout step" },
    });
    expect(mockPrisma.sopAssessment.update).toHaveBeenCalledWith({
      where: { id: 400 },
      data: expect.objectContaining({ status: "ChangesRequested", markedByUserId: "u9" }),
    });
  });

  it("rejects a non-designated non-admin marker", async () => {
    mockSubmittedAssessment();
    mockPrisma.sopTrainerAssignment.findUnique.mockResolvedValue(null);

    await expect(
      sopAssessmentService.mark(400, "u9", "Trainer", { action: "pass", verdicts: [] }),
    ).rejects.toThrow("NOT_AUTHORISED");
  });

  it("allows an Admin who is not designated", async () => {
    mockSubmittedAssessment();
    mockPrisma.sopTrainerAssignment.findUnique.mockResolvedValue(null);
    mockPrisma.sopAnswer.findMany.mockResolvedValue([
      { id: 601, questionId: 100, verdict: "Insufficient" },
    ]);

    await sopAssessmentService.mark(400, "u9", "Admin", {
      action: "requestChanges",
      verdicts: [{ answerId: 601, verdict: "Insufficient" }],
    });

    expect(mockPrisma.sopAssessment.update).toHaveBeenCalled();
  });

  it("rejects marking an assessment that is not Submitted", async () => {
    mockSubmittedAssessment();
    mockPrisma.sopAssessment.findUnique.mockResolvedValue({
      id: 400,
      employeeId: 50,
      revisionId: 10,
      status: "InProgress",
      revision: { trainingId: 1 },
    });

    await expect(
      sopAssessmentService.mark(400, "u9", "Admin", { action: "pass", verdicts: [] }),
    ).rejects.toThrow("INVALID_STATE");
  });

  it("still commits the Pass when the notification path throws", async () => {
    // Best-effort delivery: a failed employee email must not roll back the
    // already-committed Pass (which also created the Practical record).
    mockSubmittedAssessment();
    mockPrisma.sopAnswer.findMany.mockResolvedValue([
      { id: 601, questionId: 100, verdict: "Sufficient" },
    ]);
    const eff = new Date("2025-01-01");
    mockPrisma.trainingRevision.findMany.mockResolvedValue([
      { id: 30, effectiveDate: eff, createdAt: eff, overrideRequiresRetraining: null },
    ]);
    mockPrisma.trainingRecords.findFirst.mockResolvedValue(null);
    mockPrisma.trainingRecords.create.mockResolvedValue({ id: 950 });
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(emailTemplateService.render).mockRejectedValueOnce(new Error("smtp down"));

    await expect(
      sopAssessmentService.mark(400, "u9", "Trainer", {
        action: "pass",
        verdicts: [{ answerId: 601, verdict: "Sufficient" }],
      }),
    ).resolves.toBeUndefined();

    expect(mockPrisma.sopAssessment.update).toHaveBeenCalledWith({
      where: { id: 400 },
      data: expect.objectContaining({ status: "Passed", practicalRecordId: 950 }),
    });
  });
});

describe("getForActor", () => {
  function mockAssessmentForActor(extra: Record<string, unknown> = {}) {
    mockPrisma.sopAssessment.findUnique.mockResolvedValue({
      id: 400,
      employeeId: 50,
      revisionId: 10,
      status: "Submitted",
      employee: {
        id: 50,
        preferredFirstName: null,
        legalFirstName: "Erin",
        preferredLastName: null,
        legalLastName: "Employee",
      },
      revision: {
        id: 10,
        revisionLabel: "2025 Edition",
        trainingId: 1,
        documentPath: "sop-documents/a.pdf",
        training: { id: 1, title: "Pump Rebuild - Task Sheet" },
        sopQuestions: [
          { id: 100, order: 1, questionText: "How?", markerNotes: "cite lockout" },
        ],
      },
      answers: [{ id: 601, questionId: 100, answerText: "..." }],
      practicalRecord: null,
      ...extra,
    });
    const eff = new Date("2025-01-01");
    mockPrisma.trainingRevision.findMany.mockResolvedValue([
      { id: 10, effectiveDate: eff, createdAt: eff, overrideRequiresRetraining: null },
    ]);
  }

  it("owner sees the assessment with markerNotes stripped", async () => {
    mockAssessmentForActor();
    mockPrisma.user.findUnique.mockResolvedValue({ employeeId: 50 });
    mockPrisma.sopTrainerAssignment.findUnique.mockResolvedValue(null);

    const result = await sopAssessmentService.getForActor(400, "u1", "General");

    expect(result.viewer).toEqual({ isOwner: true, canMark: false });
    expect(result.revision.sopQuestions[0].markerNotes).toBeNull();
    expect(result.onCurrentRevision).toBe(true);
  });

  it("a designated trainer sees markerNotes", async () => {
    mockAssessmentForActor();
    mockPrisma.user.findUnique.mockResolvedValue({ employeeId: 70 });
    mockPrisma.sopTrainerAssignment.findUnique.mockResolvedValue({
      trainingId: 1,
      employeeId: 70,
    });

    const result = await sopAssessmentService.getForActor(400, "u9", "Trainer");

    expect(result.viewer).toEqual({ isOwner: false, canMark: true });
    expect(result.revision.sopQuestions[0].markerNotes).toBe("cite lockout");
  });

  it("rejects a non-owner, non-marker", async () => {
    mockAssessmentForActor();
    mockPrisma.user.findUnique.mockResolvedValue({ employeeId: 99 });
    mockPrisma.sopTrainerAssignment.findUnique.mockResolvedValue(null);

    await expect(
      sopAssessmentService.getForActor(400, "u9", "General"),
    ).rejects.toThrow("NOT_AUTHORISED");
  });
});

describe("listMine", () => {
  it("returns a ready SOP row with completion + readiness flags", async () => {
    mockLinkedEmployee(); // caller linked to employee 50
    mockPrisma.employee.findUnique.mockResolvedValue({ departmentId: 3, locationId: 4 });
    mockPrisma.trainingRequirement.findMany.mockResolvedValue([
      { training: { id: 1, title: "Pump Rebuild - Task Sheet", sopPartnerId: 2 } },
    ]);
    // task sheet recorded, practical not yet
    mockPrisma.trainingRecords.findMany.mockResolvedValue([{ trainingId: 1 }]);
    mockPrisma.sopAssessment.findMany.mockResolvedValue([]); // no active assessment
    const eff = new Date("2025-01-01");
    mockPrisma.trainingRevision.findMany.mockResolvedValue([
      { id: 10, effectiveDate: eff, createdAt: eff, overrideRequiresRetraining: null },
    ]);
    mockPrisma.trainingRevision.findUnique.mockResolvedValue({
      documentPath: "sop-documents/a.pdf",
    });
    mockPrisma.sopQuestion.count.mockResolvedValue(4);

    const rows = await sopAssessmentService.listMine("u1");

    expect(rows).toEqual([
      {
        taskSheetId: 1,
        title: "Pump Rebuild",
        taskSheetDone: true,
        practicalDone: false,
        ready: true,
        currentRevisionId: 10,
        assessment: null,
      },
    ]);
  });

  it("treats -1 as the all-departments / all-locations wildcard", async () => {
    mockLinkedEmployee();
    mockPrisma.employee.findUnique.mockResolvedValue({ departmentId: 8, locationId: 2 });
    mockPrisma.trainingRequirement.findMany.mockResolvedValue([]);

    await sopAssessmentService.listMine("u1");

    expect(mockPrisma.trainingRequirement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { departmentId: 8, locationId: 2 },
            { departmentId: -1, locationId: 2 },
            { departmentId: 8, locationId: -1 },
            { departmentId: -1, locationId: -1 },
          ],
        }),
      }),
    );
  });

  it("surfaces a pair whose requirement sits on the Practical half", async () => {
    mockLinkedEmployee();
    mockPrisma.employee.findUnique.mockResolvedValue({ departmentId: 8, locationId: 2 });
    mockPrisma.trainingRequirement.findMany.mockResolvedValue([
      {
        training: {
          id: 389,
          title: "2 Way Radio - Practical",
          sopPartnerId: null,
          sopPartnerOf: { id: 390, title: "2 Way Radio - Task Sheet", isActive: true },
        },
      },
    ]);
    mockReadySop();

    const rows = await sopAssessmentService.listMine("u1");

    expect(rows).toEqual([
      expect.objectContaining({ taskSheetId: 390, title: "2 Way Radio", ready: true }),
    ]);
  });

  it("collapses a pair required on both halves into one row", async () => {
    mockLinkedEmployee();
    mockPrisma.employee.findUnique.mockResolvedValue({ departmentId: 8, locationId: 2 });
    mockPrisma.trainingRequirement.findMany.mockResolvedValue([
      {
        training: {
          id: 390,
          title: "2 Way Radio - Task Sheet",
          sopPartnerId: 389,
          sopPartnerOf: null,
        },
      },
      {
        training: {
          id: 389,
          title: "2 Way Radio - Practical",
          sopPartnerId: null,
          sopPartnerOf: { id: 390, title: "2 Way Radio - Task Sheet", isActive: true },
        },
      },
    ]);
    mockReadySop();

    const rows = await sopAssessmentService.listMine("u1");

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ taskSheetId: 390, title: "2 Way Radio" });
  });

  it("skips a Practical-side requirement whose Task Sheet is inactive", async () => {
    mockLinkedEmployee();
    mockPrisma.employee.findUnique.mockResolvedValue({ departmentId: 8, locationId: 2 });
    mockPrisma.trainingRequirement.findMany.mockResolvedValue([
      {
        training: {
          id: 357,
          title: "2 Way Radio 2014 - Practical",
          sopPartnerId: null,
          sopPartnerOf: { id: 307, title: "2 Way Radio 2014 - Task Sheet", isActive: false },
        },
      },
    ]);
    mockReadySop();

    expect(await sopAssessmentService.listMine("u1")).toEqual([]);
  });
});

describe("listCompletedForEmployee", () => {
  it("returns only Passed assessments that still own both records", async () => {
    mockPrisma.sopAssessment.findMany.mockResolvedValue([
      { id: 7, markedAt: new Date("2026-07-14"), revision: { trainingId: 390 } },
    ]);

    const rows = await sopAssessmentService.listCompletedForEmployee(50);

    expect(mockPrisma.sopAssessment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          employeeId: 50,
          status: "Passed",
          taskSheetRecordId: { not: null },
          practicalRecordId: { not: null },
        },
      }),
    );
    expect(rows).toEqual([
      { assessmentId: 7, taskSheetTrainingId: 390, markedAt: new Date("2026-07-14") },
    ]);
  });
});

describe("getCompletionEvidence", () => {
  function mockPassedAssessment(overrides: Record<string, unknown> = {}) {
    mockPrisma.sopAssessment.findUnique.mockResolvedValue({
      id: 7,
      employeeId: 50,
      status: "Passed",
      submittedAt: new Date("2026-07-12"),
      markedAt: new Date("2026-07-14T03:20:00Z"),
      markedByUserId: "u-trainer",
      employee: {
        preferredFirstName: "Brandon",
        legalFirstName: "Brandon",
        preferredLastName: "Wiedman",
        legalLastName: "Wiedman",
      },
      revision: {
        revisionLabel: "2025/10/15",
        trainingId: 390,
        training: { title: "2 Way Radio - Task Sheet" },
        sopQuestions: [
          { id: 1, order: 1, questionText: "Channel to use?" },
          { id: 2, order: 2, questionText: "Battery check?" },
        ],
      },
      answers: [
        { questionId: 1, answerText: "Channel 3", verdict: "Sufficient", trainerComment: null },
        { questionId: 2, answerText: "Daily", verdict: "Sufficient", trainerComment: "Good" },
      ],
      taskSheetRecord: { dateCompleted: new Date("2026-07-12"), trainer: "Self-acknowledged (HRT)" },
      practicalRecord: { dateCompleted: new Date("2026-07-14"), trainer: "Terry Trainer" },
      ...overrides,
    });
  }

  it("assembles questions, answers and both sign-off halves", async () => {
    mockPassedAssessment();
    mockPrisma.user.findUnique.mockResolvedValue({ name: "Terry Trainer" });

    const evidence = await sopAssessmentService.getCompletionEvidence(7);

    expect(evidence).toMatchObject({
      employeeId: 50,
      employeeName: "Brandon Wiedman",
      sopTitle: "2 Way Radio",
      revisionLabel: "2025/10/15",
      acknowledgedOn: new Date("2026-07-12"),
      practicalOn: new Date("2026-07-14"),
      trainerName: "Terry Trainer",
      markedByName: "Terry Trainer",
    });
    expect(evidence.rows).toEqual([
      {
        order: 1,
        questionText: "Channel to use?",
        answerText: "Channel 3",
        verdict: "Sufficient",
        trainerComment: null,
      },
      {
        order: 2,
        questionText: "Battery check?",
        answerText: "Daily",
        verdict: "Sufficient",
        trainerComment: "Good",
      },
    ]);
  });

  it("refuses an assessment that has not passed", async () => {
    mockPassedAssessment({ status: "Submitted" });
    await expect(sopAssessmentService.getCompletionEvidence(7)).rejects.toThrow(
      "NOT_COMPLETED",
    );
  });

  it("refuses when a record half has been deleted", async () => {
    mockPassedAssessment({ practicalRecord: null });
    await expect(sopAssessmentService.getCompletionEvidence(7)).rejects.toThrow(
      "NOT_COMPLETED",
    );
  });
});

describe("listQueue", () => {
  it("admins see every Submitted assessment", async () => {
    mockPrisma.sopAssessment.findMany.mockResolvedValue([]);
    await sopAssessmentService.listQueue("u9", "Admin");
    expect(mockPrisma.sopAssessment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "Submitted" } }),
    );
  });

  it("trainers see only their designated SOPs", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ employeeId: 70 });
    mockPrisma.sopTrainerAssignment.findMany.mockResolvedValue([
      { trainingId: 1 },
      { trainingId: 5 },
    ]);
    mockPrisma.sopAssessment.findMany.mockResolvedValue([]);

    await sopAssessmentService.listQueue("u9", "Trainer");

    expect(mockPrisma.sopAssessment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "Submitted", revision: { trainingId: { in: [1, 5] } } },
      }),
    );
  });

  it("a user with no linked employee gets an empty queue", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ employeeId: null });
    expect(await sopAssessmentService.listQueue("u9", "Trainer")).toEqual([]);
  });
});
