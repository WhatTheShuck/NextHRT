import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    user: { findUnique: vi.fn(), findMany: vi.fn() },
    employee: { findUnique: vi.fn() },
    trainingRevision: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    trainingRecords: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    quizResponse: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    appSetting: { findUnique: vi.fn() },
    history: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
  return { mockPrisma };
});

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));
vi.mock("@/lib/services/mailService", () => ({ mailService: { send: vi.fn() } }));
vi.mock("@/lib/services/emailTemplateService", () => ({
  emailTemplateService: {
    render: vi.fn().mockResolvedValue({ subject: "s", body: "b" }),
  },
}));

import { quizService } from "@/lib/services/quizService";
import { mailService } from "@/lib/services/mailService";
import { emailTemplateService } from "@/lib/services/emailTemplateService";

// A small document: gate (S0) + laptop track (S1) with a knowledge choice,
// a scale, a multiselect, and an optional text.
const DOC = {
  version: 1,
  sections: [
    {
      id: "s0",
      title: "Welcome",
      items: [
        { id: "welcome", type: "info", prompt: "Hi", body: "Not a test." },
        {
          id: "gate",
          type: "choice",
          prompt: "Setup?",
          options: [
            { id: "laptop", label: "Laptop" },
            { id: "ipad", label: "iPad" },
          ],
        },
      ],
    },
    {
      id: "s1",
      title: "Laptop",
      showIf: { itemId: "gate", in: ["laptop"] },
      items: [
        {
          id: "photos",
          type: "choice",
          prompt: "Phone photos?",
          options: [
            { id: "camupload", label: "OneDrive", correct: true, coaching: "Enable camera upload." },
            { id: "email", label: "Email to self" },
          ],
        },
        { id: "onedrive", type: "scale", prompt: "OneDrive?", scaleLabels: ["Never", "A bit", "Confidently"] },
        {
          id: "apps",
          type: "multiselect",
          prompt: "Used?",
          options: [
            { id: "word", label: "Word" },
            { id: "excel", label: "Excel" },
          ],
        },
        { id: "frustration", type: "text", prompt: "Frustrations?", optional: true },
      ],
    },
  ],
};
const CONTENT = JSON.stringify(DOC);

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
});

function mockLinkedEmployee(employeeId: number | null = 50) {
  mockPrisma.user.findUnique.mockResolvedValue(
    employeeId === null ? { employeeId: null } : { employeeId, name: "Ned" },
  );
}

/** Training 1 has revision 10 current, with quiz content. */
function mockReadyTraining() {
  const eff = new Date("2025-01-01");
  mockPrisma.trainingRevision.findMany.mockResolvedValue([
    { id: 10, effectiveDate: eff, createdAt: eff, overrideRequiresRetraining: null },
  ]);
  mockPrisma.trainingRevision.findUnique.mockResolvedValue({ id: 10, quizContent: CONTENT });
}

/** An owned InProgress response on revision 10 / training 1 with given answers. */
function mockOwnedResponse(status: string, answers: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) {
  mockLinkedEmployee();
  mockPrisma.quizResponse.findUnique.mockResolvedValue({
    id: 400,
    employeeId: 50,
    revisionId: 10,
    status,
    answers: JSON.stringify(answers),
    trainingRecordId: null,
    revision: { trainingId: 1, quizContent: CONTENT },
    ...extra,
  });
}

describe("setContent", () => {
  it("validates, stores normalised JSON, and logs history", async () => {
    mockPrisma.trainingRevision.findUnique.mockResolvedValue({ id: 10, trainingId: 1 });
    mockPrisma.quizResponse.count.mockResolvedValue(0);

    await quizService.setContent(1, 10, CONTENT, "u1");

    expect(mockPrisma.trainingRevision.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { quizContent: expect.any(String) },
    });
    expect(mockPrisma.history.create).toHaveBeenCalled();
  });

  it("throws INVALID_QUIZ_CONTENT for a document that fails validation", async () => {
    mockPrisma.trainingRevision.findUnique.mockResolvedValue({ id: 10, trainingId: 1 });
    const bad = JSON.stringify({ version: 1, sections: [] }); // min(1) sections
    await expect(quizService.setContent(1, 10, bad, "u1")).rejects.toThrow("INVALID_QUIZ_CONTENT");
  });

  it("warns QUIZ_HAS_RESPONSES when responses exist and confirm is falsy", async () => {
    mockPrisma.trainingRevision.findUnique.mockResolvedValue({ id: 10, trainingId: 1 });
    mockPrisma.quizResponse.count.mockResolvedValue(3);
    await expect(quizService.setContent(1, 10, CONTENT, "u1")).rejects.toThrow("QUIZ_HAS_RESPONSES");
  });

  it("saves despite responses when confirm is true", async () => {
    mockPrisma.trainingRevision.findUnique.mockResolvedValue({ id: 10, trainingId: 1 });
    mockPrisma.quizResponse.count.mockResolvedValue(3);
    await quizService.setContent(1, 10, CONTENT, "u1", true);
    expect(mockPrisma.trainingRevision.update).toHaveBeenCalled();
  });
});

describe("copyForward", () => {
  it("copies quiz content from the previously-current revision", async () => {
    const eff = new Date("2025-01-01");
    mockPrisma.trainingRevision.findMany.mockResolvedValue([
      { id: 9, effectiveDate: eff, createdAt: eff, overrideRequiresRetraining: null },
    ]);
    mockPrisma.trainingRevision.findUnique.mockResolvedValue({ quizContent: CONTENT });

    await quizService.copyForward(1, 11);

    expect(mockPrisma.trainingRevision.update).toHaveBeenCalledWith({
      where: { id: 11 },
      data: { quizContent: CONTENT },
    });
  });

  it("is a no-op when the source revision has no quiz content", async () => {
    const eff = new Date("2025-01-01");
    mockPrisma.trainingRevision.findMany.mockResolvedValue([
      { id: 9, effectiveDate: eff, createdAt: eff, overrideRequiresRetraining: null },
    ]);
    mockPrisma.trainingRevision.findUnique.mockResolvedValue({ quizContent: null });

    await quizService.copyForward(1, 11);
    expect(mockPrisma.trainingRevision.update).not.toHaveBeenCalled();
  });
});

describe("start", () => {
  it("creates an InProgress response pinned to the current revision", async () => {
    mockLinkedEmployee();
    mockReadyTraining();
    mockPrisma.quizResponse.findFirst.mockResolvedValue(null);
    mockPrisma.quizResponse.create.mockResolvedValue({ id: 500, status: "InProgress" });

    const result = await quizService.start("u1", 1);

    expect(mockPrisma.quizResponse.create).toHaveBeenCalledWith({
      data: { employeeId: 50, revisionId: 10, status: "InProgress", answers: "{}" },
    });
    expect(result).toEqual({ id: 500, status: "InProgress" });
  });

  it("returns the existing non-terminal response instead of a second", async () => {
    mockLinkedEmployee();
    mockReadyTraining();
    mockPrisma.quizResponse.findFirst.mockResolvedValue({ id: 400, status: "InProgress" });

    const result = await quizService.start("u1", 1);
    expect(result).toEqual({ id: 400, status: "InProgress" });
    expect(mockPrisma.quizResponse.create).not.toHaveBeenCalled();
  });

  it("throws QUIZ_NOT_READY when the current revision has no content", async () => {
    mockLinkedEmployee();
    const eff = new Date("2025-01-01");
    mockPrisma.trainingRevision.findMany.mockResolvedValue([
      { id: 10, effectiveDate: eff, createdAt: eff, overrideRequiresRetraining: null },
    ]);
    mockPrisma.quizResponse.findFirst.mockResolvedValue(null);
    mockPrisma.trainingRevision.findUnique.mockResolvedValue({ id: 10, quizContent: null });
    await expect(quizService.start("u1", 1)).rejects.toThrow("QUIZ_NOT_READY");
  });

  it("throws NO_LINKED_EMPLOYEE without a linked employee", async () => {
    mockLinkedEmployee(null);
    await expect(quizService.start("u1", 1)).rejects.toThrow("NO_LINKED_EMPLOYEE");
  });
});

describe("restart", () => {
  it("supersedes the old response and starts fresh, releasing the record link", async () => {
    mockLinkedEmployee();
    mockPrisma.quizResponse.findUnique.mockResolvedValue({
      id: 400,
      employeeId: 50,
      status: "InProgress",
      revisionId: 9,
      trainingRecordId: 900,
      revision: { trainingId: 1 },
    });
    mockReadyTraining();
    mockPrisma.quizResponse.create.mockResolvedValue({ id: 501, status: "InProgress" });

    const result = await quizService.restart(400, "u1");

    expect(mockPrisma.quizResponse.update).toHaveBeenCalledWith({
      where: { id: 400 },
      data: { status: "Superseded", trainingRecordId: null },
    });
    expect(mockPrisma.quizResponse.create).toHaveBeenCalledWith({
      data: { employeeId: 50, revisionId: 10, status: "InProgress", answers: "{}", trainingRecordId: null },
    });
    expect(result).toEqual({ id: 501, status: "InProgress" });
  });

  it("rejects restart by a non-owner", async () => {
    mockLinkedEmployee(51);
    mockPrisma.quizResponse.findUnique.mockResolvedValue({
      id: 400, employeeId: 50, status: "InProgress", revisionId: 9, revision: { trainingId: 1 },
    });
    await expect(quizService.restart(400, "u1")).rejects.toThrow("NOT_AUTHORISED");
  });

  it("rejects restart of a terminal response", async () => {
    mockLinkedEmployee();
    mockPrisma.quizResponse.findUnique.mockResolvedValue({
      id: 400, employeeId: 50, status: "Completed", revisionId: 9, revision: { trainingId: 1 },
    });
    await expect(quizService.restart(400, "u1")).rejects.toThrow("INVALID_STATE");
  });
});

describe("saveAnswer", () => {
  it("locks and reveals a correct-option choice", async () => {
    mockOwnedResponse("InProgress");
    const reveal = await quizService.saveAnswer(400, "u1", { itemId: "photos", value: "email" });
    expect(reveal).toEqual({
      locked: true, wasCorrect: false, correctOptionId: "camupload", coaching: "Enable camera upload.",
    });
    const updateArg = mockPrisma.quizResponse.update.mock.calls[0][0];
    expect(JSON.parse(updateArg.data.answers).photos).toEqual({ value: "email", wasCorrect: false });
  });

  it("marks wasCorrect true when the correct option is picked", async () => {
    mockOwnedResponse("InProgress");
    const reveal = await quizService.saveAnswer(400, "u1", { itemId: "photos", value: "camupload" });
    expect(reveal.wasCorrect).toBe(true);
  });

  it("does not reveal for the gate (correct-less choice)", async () => {
    mockOwnedResponse("InProgress");
    const reveal = await quizService.saveAnswer(400, "u1", { itemId: "gate", value: "laptop" });
    expect(reveal).toEqual({ locked: false });
  });

  it("stores an empty multiselect as answered without a reveal", async () => {
    mockOwnedResponse("InProgress");
    const reveal = await quizService.saveAnswer(400, "u1", { itemId: "apps", value: [] });
    expect(reveal).toEqual({ locked: false });
    const updateArg = mockPrisma.quizResponse.update.mock.calls[0][0];
    expect(JSON.parse(updateArg.data.answers).apps).toEqual({ value: [] });
  });

  it("rejects re-answering a locked item", async () => {
    mockOwnedResponse("InProgress", { photos: { value: "email", wasCorrect: false } });
    await expect(
      quizService.saveAnswer(400, "u1", { itemId: "photos", value: "camupload" }),
    ).rejects.toThrow("ITEM_LOCKED");
  });

  it("allows re-answering an unlocked item (the gate)", async () => {
    mockOwnedResponse("InProgress", { gate: { value: "laptop" } });
    await quizService.saveAnswer(400, "u1", { itemId: "gate", value: "ipad" });
    const updateArg = mockPrisma.quizResponse.update.mock.calls[0][0];
    expect(JSON.parse(updateArg.data.answers).gate).toEqual({ value: "ipad" });
  });

  it("rejects an unknown item id", async () => {
    mockOwnedResponse("InProgress");
    await expect(
      quizService.saveAnswer(400, "u1", { itemId: "nope", value: "x" }),
    ).rejects.toThrow("INVALID_ITEM");
  });

  it("rejects a scale index out of range", async () => {
    mockOwnedResponse("InProgress");
    await expect(
      quizService.saveAnswer(400, "u1", { itemId: "onedrive", value: 9 }),
    ).rejects.toThrow("INVALID_VALUE");
  });

  it("rejects a choice value that is not an option id", async () => {
    mockOwnedResponse("InProgress");
    await expect(
      quizService.saveAnswer(400, "u1", { itemId: "gate", value: "desktop" }),
    ).rejects.toThrow("INVALID_VALUE");
  });

  it("rejects saving on a terminal response", async () => {
    mockOwnedResponse("Completed");
    await expect(
      quizService.saveAnswer(400, "u1", { itemId: "gate", value: "laptop" }),
    ).rejects.toThrow("INVALID_STATE");
  });

  it("rejects a non-owner", async () => {
    mockLinkedEmployee(51);
    mockPrisma.quizResponse.findUnique.mockResolvedValue({
      id: 400, employeeId: 50, status: "InProgress", answers: "{}", revision: { trainingId: 1, quizContent: CONTENT },
    });
    await expect(
      quizService.saveAnswer(400, "u1", { itemId: "gate", value: "laptop" }),
    ).rejects.toThrow("NOT_AUTHORISED");
  });
});

describe("submit", () => {
  // Fully-answered laptop-track blob: gate + all required S1 items.
  const complete = {
    gate: { value: "laptop" },
    photos: { value: "camupload", wasCorrect: true },
    onedrive: { value: 1 },
    apps: { value: ["word"] },
  };

  it("rejects submit while a required visible item is unanswered", async () => {
    mockOwnedResponse("InProgress", { gate: { value: "laptop" }, photos: { value: "email", wasCorrect: false } });
    await expect(quizService.submit(400, "u1")).rejects.toThrow("INCOMPLETE");
  });

  it("ignores hidden-branch items for completeness (iPad gate skips S1)", async () => {
    mockOwnedResponse("InProgress", { gate: { value: "ipad" } });
    mockPrisma.trainingRecords.findFirst.mockResolvedValue(null);
    mockPrisma.trainingRecords.create.mockResolvedValue({ id: 900 });
    mockPrisma.appSetting.findUnique.mockResolvedValue({ value: "it@ksb.com" });
    mockPrisma.employee.findUnique.mockResolvedValue({
      preferredFirstName: null, legalFirstName: "N", preferredLastName: null, legalLastName: "S",
    });
    // buildSummary lookups (fired via notifySummary is separate; submit calls it)
    await expect(quizService.submit(400, "u1")).resolves.toBeUndefined();
    expect(mockPrisma.trainingRecords.create).toHaveBeenCalled();
  });

  it("completes: creates a self-completed record stamped with the revision", async () => {
    mockOwnedResponse("InProgress", complete);
    mockPrisma.trainingRecords.findFirst.mockResolvedValue(null);
    mockPrisma.trainingRecords.create.mockResolvedValue({ id: 900 });
    mockPrisma.appSetting.findUnique.mockResolvedValue({ value: "it@ksb.com" });
    mockPrisma.employee.findUnique.mockResolvedValue({
      preferredFirstName: null, legalFirstName: "Erin", preferredLastName: null, legalLastName: "E",
    });

    await quizService.submit(400, "u1");

    const createArg = mockPrisma.trainingRecords.create.mock.calls[0][0];
    expect(createArg.data.trainingId).toBe(1);
    expect(createArg.data.revisionId).toBe(10);
    expect(createArg.data.trainer).toBe("Self-completed (HRT)");
    expect(mockPrisma.quizResponse.update).toHaveBeenCalledWith({
      where: { id: 400 },
      data: expect.objectContaining({ status: "Completed", trainingRecordId: 900 }),
    });
    expect(vi.mocked(mailService.send)).toHaveBeenCalledWith(
      expect.objectContaining({ to: ["it@ksb.com"] }),
    );
  });

  it("reuses a same-day record, releasing another response's link and moving the stamp", async () => {
    mockOwnedResponse("InProgress", complete);
    mockPrisma.trainingRecords.findFirst.mockResolvedValue({
      id: 901, trainer: "Self-completed (HRT)", revisionId: 9,
    });
    mockPrisma.appSetting.findUnique.mockResolvedValue({ value: "it@ksb.com" });
    mockPrisma.employee.findUnique.mockResolvedValue({
      preferredFirstName: null, legalFirstName: "Erin", preferredLastName: null, legalLastName: "E",
    });

    await quizService.submit(400, "u1");

    expect(mockPrisma.trainingRecords.create).not.toHaveBeenCalled();
    expect(mockPrisma.quizResponse.updateMany).toHaveBeenCalledWith({
      where: { trainingRecordId: 901, id: { not: 400 } },
      data: { trainingRecordId: null },
    });
    expect(mockPrisma.trainingRecords.update).toHaveBeenCalledWith({
      where: { id: 901 },
      data: { revisionId: 10 },
    });
  });

  it("falls back to admins when the summary email setting is unset", async () => {
    mockOwnedResponse("InProgress", complete);
    mockPrisma.trainingRecords.findFirst.mockResolvedValue(null);
    mockPrisma.trainingRecords.create.mockResolvedValue({ id: 900 });
    mockPrisma.appSetting.findUnique.mockResolvedValue({ value: "" });
    mockPrisma.user.findMany.mockResolvedValue([{ email: "admin@ksb.com" }]);
    mockPrisma.employee.findUnique.mockResolvedValue({
      preferredFirstName: null, legalFirstName: "Erin", preferredLastName: null, legalLastName: "E",
    });

    await quizService.submit(400, "u1");

    expect(vi.mocked(mailService.send)).toHaveBeenCalledWith(
      expect.objectContaining({ to: ["admin@ksb.com"] }),
    );
  });

  it("still completes when the notification path throws", async () => {
    mockOwnedResponse("InProgress", complete);
    mockPrisma.trainingRecords.findFirst.mockResolvedValue(null);
    mockPrisma.trainingRecords.create.mockResolvedValue({ id: 900 });
    mockPrisma.appSetting.findUnique.mockResolvedValue({ value: "it@ksb.com" });
    mockPrisma.employee.findUnique.mockResolvedValue({
      preferredFirstName: null, legalFirstName: "Erin", preferredLastName: null, legalLastName: "E",
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(emailTemplateService.render).mockRejectedValueOnce(new Error("smtp down"));

    await expect(quizService.submit(400, "u1")).resolves.toBeUndefined();
    expect(mockPrisma.quizResponse.update).toHaveBeenCalledWith({
      where: { id: 400 },
      data: expect.objectContaining({ status: "Completed" }),
    });
  });

  it("rejects submit on a terminal response", async () => {
    mockOwnedResponse("Completed", complete);
    await expect(quizService.submit(400, "u1")).rejects.toThrow("INVALID_STATE");
  });
});

describe("getPlayerDocument", () => {
  it("strips correct and coaching from every option", async () => {
    mockPrisma.trainingRevision.findUnique.mockResolvedValue({ quizContent: CONTENT });
    const doc = await quizService.getPlayerDocument(10);
    const photos = doc.sections[1].items[0] as { options: Record<string, unknown>[] };
    expect(photos.options[0]).not.toHaveProperty("correct");
    expect(photos.options[0]).not.toHaveProperty("coaching");
  });
});

describe("buildSummary", () => {
  function mockResponseForSummary(answers: Record<string, unknown>) {
    mockPrisma.quizResponse.findUnique.mockResolvedValue({
      id: 400,
      employeeId: 50,
      revisionId: 10,
      status: "Completed",
      completedAt: new Date("2026-07-09"),
      answers: JSON.stringify(answers),
      employee: {
        id: 50, preferredFirstName: "Erin", legalFirstName: "Erin", preferredLastName: null, legalLastName: "E",
      },
      revision: {
        id: 10, revisionLabel: "v1", trainingId: 1, quizContent: CONTENT,
        training: { id: 1, title: "IT Induction" },
      },
    });
  }

  it("captures gate, self-assessment, flagged knowledge item, and free text", async () => {
    mockResponseForSummary({
      gate: { value: "laptop" },
      photos: { value: "email", wasCorrect: false },
      onedrive: { value: 2 },
      apps: { value: ["excel"] },
      frustration: { value: "printer won't sign in" },
    });

    const summary = await quizService.buildSummary(400);

    expect(summary.gate).toEqual([{ prompt: "Setup?", answerLabel: "Laptop" }]);
    expect(summary.selfAssessment).toContainEqual({ prompt: "OneDrive?", ratingLabel: "Confidently" });
    expect(summary.selfAssessment).toContainEqual({ prompt: "Used?", ratingLabel: "Excel" });
    expect(summary.flagged).toEqual([
      { prompt: "Phone photos?", pickedLabel: "Email to self", coachedLabel: "OneDrive", coaching: "Enable camera upload." },
    ]);
    expect(summary.freeText).toEqual([{ prompt: "Frustrations?", value: "printer won't sign in" }]);
    expect(summary.coachingTopics).toEqual(["Phone photos?"]);
  });

  it("does not flag a correct knowledge answer", async () => {
    mockResponseForSummary({
      gate: { value: "laptop" }, photos: { value: "camupload", wasCorrect: true }, onedrive: { value: 0 }, apps: { value: [] },
    });
    const summary = await quizService.buildSummary(400);
    expect(summary.flagged).toEqual([]);
  });

  it("excludes hidden-branch answers under the final gate", async () => {
    // gate is iPad → S1 is hidden, so the laptop photos answer is ignored
    mockResponseForSummary({
      gate: { value: "ipad" }, photos: { value: "email", wasCorrect: false },
    });
    const summary = await quizService.buildSummary(400);
    expect(summary.flagged).toEqual([]);
    expect(summary.selfAssessment).toEqual([]);
  });
});
