import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma: any = {
    employee: { findUnique: vi.fn() },
    ticket: { findUnique: vi.fn() },
    training: { findUnique: vi.fn() },
    ticketRecords: { findFirst: vi.fn(), create: vi.fn() },
    trainingRecords: { findFirst: vi.fn(), create: vi.fn() },
    documentSubmission: { create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() },
    documentSubmissionFile: { deleteMany: vi.fn(), createMany: vi.fn() },
    missingDocumentReminder: { deleteMany: vi.fn() },
    history: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
  return { mockPrisma };
});
vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

const { canActForEmployee, getEmployeeIdsInScope } = vi.hoisted(() => ({
  canActForEmployee: vi.fn(),
  getEmployeeIdsInScope: vi.fn(),
}));
vi.mock("@/lib/services/employeeScopeService", () => ({
  canActForEmployee,
  getEmployeeIdsInScope,
  scopeWhere: (s: any) => (s === "all" ? {} : { id: { in: s } }),
}));

const { saveFiles } = vi.hoisted(() => ({ saveFiles: vi.fn() }));
vi.mock("@/lib/services/fileUploadService", () => ({
  SUBMISSIONS_DIR: "submissions",
  fileUploadService: { saveFiles },
}));

const { enqueue } = vi.hoisted(() => ({ enqueue: vi.fn() }));
vi.mock("@/lib/jobs/jobQueue", () => ({ enqueue }));
vi.mock("@/lib/services/emailTemplateService", () => ({
  emailTemplateService: { render: vi.fn().mockResolvedValue({ subject: "s", body: "b" }) },
}));
vi.mock("@/lib/data", () => ({ companyDetails: { domain_extension: "ksb.com.au" } }));

import { documentSubmissionService } from "@/lib/services/documentSubmissionService";

const jpeg = () => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0])], "a.jpg", { type: "image/jpeg" });
const html = () => new File(["<html>"], "a.jpg", { type: "image/jpeg" });
const actor = { userId: "u1", role: "User" };
const ticketFields = {
  employeeId: 1, kind: "Ticket" as const, itemId: 10,
  dateIssued: new Date("2026-01-09T14:00:00.000Z"), expiryDate: null, licenseNumber: "L1", provider: null,
};
const trainingFields = {
  employeeId: 1, kind: "Training" as const, itemId: 20,
  dateIssued: new Date("2026-01-09T14:00:00.000Z"), expiryDate: null, licenseNumber: null, provider: "St John",
};

beforeEach(() => {
  canActForEmployee.mockResolvedValue(true);
  mockPrisma.employee.findUnique.mockResolvedValue({ isActive: true });
  mockPrisma.ticket.findUnique.mockResolvedValue({ isActive: true, renewal: 3 });
  mockPrisma.training.findUnique.mockResolvedValue({ isActive: true, category: "External", revisions: [] });
  mockPrisma.ticketRecords.findFirst.mockResolvedValue(null);
  mockPrisma.trainingRecords.findFirst.mockResolvedValue(null);
  saveFiles.mockResolvedValue([{ imagePath: "submissions/x.jpg", imageType: "image/jpeg", originalName: "a.jpg" }]);
  mockPrisma.documentSubmission.create.mockImplementation(async ({ data }: any) => ({ id: 5, ...data }));
});

describe("submit", () => {
  it("creates a Pending submission with the renewal-default expiry and files in submissions/", async () => {
    await documentSubmissionService.submit(ticketFields, [jpeg()], actor);

    expect(saveFiles).toHaveBeenCalledWith(expect.any(Array), "submissions");
    const data = mockPrisma.documentSubmission.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ employeeId: 1, kind: "Ticket", ticketId: 10, trainingId: null, submittedByUserId: "u1" });
    expect(data.expiryDate.toISOString()).toBe("2029-01-09T14:00:00.000Z");
    expect(data.files.create).toEqual([{ filePath: "submissions/x.jpg", fileType: "image/jpeg", originalName: "a.jpg" }]);
  });

  it("refuses someone outside Act scope (View-only delegates included)", async () => {
    canActForEmployee.mockResolvedValue(false);
    await expect(documentSubmissionService.submit(ticketFields, [jpeg()], actor)).rejects.toThrow("NOT_AUTHORISED");
  });

  it("refuses Internal training, inactive items and inactive employees", async () => {
    mockPrisma.training.findUnique.mockResolvedValueOnce({ isActive: true, category: "Internal", revisions: [] });
    await expect(documentSubmissionService.submit(trainingFields, [jpeg()], actor)).rejects.toThrow("ITEM_NOT_AVAILABLE");
    mockPrisma.ticket.findUnique.mockResolvedValueOnce({ isActive: false, renewal: 3 });
    await expect(documentSubmissionService.submit(ticketFields, [jpeg()], actor)).rejects.toThrow("ITEM_NOT_AVAILABLE");
    mockPrisma.employee.findUnique.mockResolvedValueOnce({ isActive: false });
    await expect(documentSubmissionService.submit(ticketFields, [jpeg()], actor)).rejects.toThrow("EMPLOYEE_INACTIVE");
  });

  it("refuses an expiry before the issue date and a duplicate record", async () => {
    await expect(
      documentSubmissionService.submit({ ...ticketFields, expiryDate: new Date("2025-01-01") }, [jpeg()], actor),
    ).rejects.toThrow("INVALID_EXPIRY_DATE");
    mockPrisma.ticketRecords.findFirst.mockResolvedValueOnce({ id: 99 });
    await expect(documentSubmissionService.submit(ticketFields, [jpeg()], actor)).rejects.toThrow("DUPLICATE_RECORD");
  });

  it("requires a provider for training", async () => {
    await expect(
      documentSubmissionService.submit({ ...trainingFields, provider: " " }, [jpeg()], actor),
    ).rejects.toThrow("PROVIDER_REQUIRED");
  });

  it("refuses no files, too many files, and a file whose bytes don't match its type", async () => {
    await expect(documentSubmissionService.submit(ticketFields, [], actor)).rejects.toThrow("NO_FILES");
    await expect(documentSubmissionService.submit(ticketFields, Array.from({ length: 7 }, jpeg), actor)).rejects.toThrow("TOO_MANY_FILES");
    await expect(documentSubmissionService.submit(ticketFields, [html()], actor)).rejects.toThrow("INVALID_FILE_TYPE");
    expect(saveFiles).not.toHaveBeenCalled();
  });

  it("stores files under the extension of what they really are", async () => {
    const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])], "scan.jpg", { type: "image/png" });
    // declared PNG + PNG bytes is accepted; the misleading .jpg name is corrected
    await documentSubmissionService.submit(ticketFields, [png], actor);
    expect(saveFiles.mock.calls[0][0][0].name).toBe("scan.png");
  });

  it("replaces an open submission for the same employee + item", async () => {
    await documentSubmissionService.submit(ticketFields, [jpeg()], actor);
    expect(mockPrisma.documentSubmission.updateMany).toHaveBeenCalledWith({
      where: { employeeId: 1, ticketId: 10, status: { in: ["Pending", "ChangesRequested"] } },
      data: { status: "Cancelled" },
    });
  });
});

describe("resubmit", () => {
  const sentBack = {
    id: 5, employeeId: 1, kind: "Ticket", ticketId: 10, trainingId: null, status: "ChangesRequested",
    submittedByUserId: "u1", files: [{ id: 1 }, { id: 2 }],
  };

  it("returns a sent-back submission to Pending with edited fields and file changes", async () => {
    mockPrisma.documentSubmission.findUnique.mockResolvedValue(sentBack);
    mockPrisma.documentSubmission.update.mockResolvedValue({ ...sentBack, status: "Pending" });

    await documentSubmissionService.resubmit(5, { ...ticketFields, licenseNumber: "L2" }, [jpeg()], [1], actor);

    expect(mockPrisma.documentSubmissionFile.deleteMany).toHaveBeenCalledWith({ where: { submissionId: 5, id: { in: [1] } } });
    expect(mockPrisma.documentSubmissionFile.createMany).toHaveBeenCalled();
    expect(mockPrisma.documentSubmission.update.mock.calls[0][0].data).toMatchObject({ status: "Pending", licenseNumber: "L2" });
  });

  it("only the submitter, only while ChangesRequested, and never a different employee or kind", async () => {
    mockPrisma.documentSubmission.findUnique.mockResolvedValue({ ...sentBack, submittedByUserId: "other" });
    await expect(documentSubmissionService.resubmit(5, ticketFields, [], [], actor)).rejects.toThrow("NOT_AUTHORISED");
    mockPrisma.documentSubmission.findUnique.mockResolvedValue(sentBack);
    canActForEmployee.mockResolvedValueOnce(false); // lost scope since submitting
    await expect(documentSubmissionService.resubmit(5, ticketFields, [], [], actor)).rejects.toThrow("NOT_AUTHORISED");
    mockPrisma.documentSubmission.findUnique.mockResolvedValue({ ...sentBack, status: "Pending" });
    await expect(documentSubmissionService.resubmit(5, ticketFields, [], [], actor)).rejects.toThrow("NOT_EDITABLE");
    mockPrisma.documentSubmission.findUnique.mockResolvedValue(sentBack);
    await expect(documentSubmissionService.resubmit(5, { ...ticketFields, employeeId: 2 }, [], [], actor)).rejects.toThrow("INVALID_CHANGE");
  });
});

describe("cancel", () => {
  it("submitter can cancel an open submission; others cannot", async () => {
    mockPrisma.documentSubmission.findUnique.mockResolvedValue({ id: 5, status: "Pending", submittedByUserId: "u1" });
    await documentSubmissionService.cancel(5, actor);
    expect(mockPrisma.documentSubmission.update).toHaveBeenCalledWith({ where: { id: 5 }, data: { status: "Cancelled" } });

    await expect(documentSubmissionService.cancel(5, { userId: "u2", role: "User" })).rejects.toThrow("NOT_AUTHORISED");
  });
});

describe("cancelOpenForEmployees", () => {
  it("cancels every open submission for the given employees", async () => {
    await documentSubmissionService.cancelOpenForEmployees([1, 2]);
    expect(mockPrisma.documentSubmission.updateMany).toHaveBeenCalledWith({
      where: { employeeId: { in: [1, 2] }, status: { in: ["Pending", "ChangesRequested"] } },
      data: { status: "Cancelled" },
    });
  });
});

describe("approve", () => {
  const admin = { userId: "a1", role: "Admin" };
  const pendingTicket = {
    id: 5, employeeId: 1, kind: "Ticket", ticketId: 10, trainingId: null, status: "Pending",
    dateIssued: new Date("2026-01-09T14:00:00.000Z"), expiryDate: new Date("2029-01-09T14:00:00.000Z"),
    licenseNumber: "L1", provider: null, submittedByUserId: "u1",
    files: [{ id: 1, filePath: "submissions/x.jpg", fileType: "image/jpeg", originalName: "a.jpg" }],
  };
  const notifyRow = {
    ...pendingTicket,
    employee: { id: 1, legalFirstName: "Jo", legalLastName: "X", preferredFirstName: null, preferredLastName: null, User: { email: "jo@x" } },
    submittedByUser: { id: "u1", email: "jo@x", employeeId: 1 },
    ticket: { ticketName: "Forklift" }, training: null,
  };

  beforeEach(() => {
    mockPrisma.documentSubmission.findUnique.mockResolvedValueOnce(pendingTicket).mockResolvedValue(notifyRow);
    mockPrisma.ticketRecords.create.mockResolvedValue({ id: 77 });
    mockPrisma.trainingRecords.create.mockResolvedValue({ id: 88 });
    mockPrisma.documentSubmission.update.mockImplementation(async ({ data }: any) => ({ ...pendingTicket, ...data }));
  });

  it("creates the ticket record with images pointing at the submission files, closes the reminder, invalidates the cache, emails", async () => {
    await documentSubmissionService.approve(5, { licenseNumber: "L9" }, admin);

    expect(mockPrisma.ticketRecords.create.mock.calls[0][0].data).toMatchObject({
      employeeId: 1, ticketId: 10, licenseNumber: "L9",
      images: { create: [{ imagePath: "submissions/x.jpg", imageType: "image/jpeg", originalName: "a.jpg" }] },
    });
    expect(mockPrisma.documentSubmission.update.mock.calls[0][0].data).toMatchObject({
      status: "Approved", resultRecordId: 77, reviewedByUserId: "a1",
    });
    expect(mockPrisma.missingDocumentReminder.deleteMany).toHaveBeenCalledWith({
      where: { employeeId: 1, itemType: "Ticket", itemId: 10 },
    });
    expect(enqueue).toHaveBeenCalledWith("REQUIREMENTS_CACHE_INVALIDATE", { employeeId: 1 });
    expect(enqueue).toHaveBeenCalledWith("SEND_EMAIL", expect.objectContaining({ to: ["jo@x"] }));
  });

  it("stamps the current revision on a training record", async () => {
    mockPrisma.documentSubmission.findUnique.mockReset();
    mockPrisma.documentSubmission.findUnique
      .mockResolvedValueOnce({ ...pendingTicket, kind: "Training", ticketId: null, trainingId: 20, expiryDate: null, licenseNumber: null, provider: "St John" })
      .mockResolvedValue({ ...notifyRow, ticket: null, training: { title: "First Aid" } });
    mockPrisma.training.findUnique.mockResolvedValue({
      isActive: true, category: "External",
      revisions: [{ id: 3, effectiveDate: new Date("2025-01-01"), createdAt: new Date("2025-01-01"), overrideRequiresRetraining: null }],
    });

    await documentSubmissionService.approve(5, {}, admin);

    expect(mockPrisma.trainingRecords.create.mock.calls[0][0].data).toMatchObject({
      trainingId: 20, trainer: "St John", revisionId: 3,
    });
  });

  it("refuses non-admins, non-pending submissions, and duplicate records (nothing written)", async () => {
    await expect(documentSubmissionService.approve(5, {}, actor)).rejects.toThrow("NOT_AUTHORISED");

    mockPrisma.documentSubmission.findUnique.mockReset();
    mockPrisma.documentSubmission.findUnique.mockResolvedValue({ ...pendingTicket, status: "Approved" });
    await expect(documentSubmissionService.approve(5, {}, admin)).rejects.toThrow("NOT_PENDING");

    mockPrisma.documentSubmission.findUnique.mockResolvedValue(pendingTicket);
    mockPrisma.ticketRecords.findFirst.mockResolvedValue({ id: 1 });
    await expect(documentSubmissionService.approve(5, {}, admin)).rejects.toThrow("DUPLICATE_RECORD");
    expect(mockPrisma.ticketRecords.create).not.toHaveBeenCalled();
  });

  it("a unique-index clash (racing approvals) surfaces as DUPLICATE_RECORD", async () => {
    mockPrisma.ticketRecords.create.mockRejectedValueOnce(Object.assign(new Error("Unique constraint"), { code: "P2002" }));
    await expect(documentSubmissionService.approve(5, {}, admin)).rejects.toThrow("DUPLICATE_RECORD");
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("moving it to another item cancels that item's other open submission", async () => {
    await documentSubmissionService.approve(5, { itemId: 11 }, admin);
    expect(mockPrisma.documentSubmission.updateMany).toHaveBeenCalledWith({
      where: { employeeId: 1, ticketId: 11, status: { in: ["Pending", "ChangesRequested"] }, id: { not: 5 } },
      data: { status: "Cancelled" },
    });
  });
});

describe("sendBack", () => {
  const admin = { userId: "a1", role: "Admin" };

  it("requires a reason, sets ChangesRequested and emails the submitter", async () => {
    await expect(documentSubmissionService.sendBack(5, "  ", admin)).rejects.toThrow("REASON_REQUIRED");

    mockPrisma.documentSubmission.findUnique
      .mockResolvedValueOnce({ id: 5, status: "Pending" })
      .mockResolvedValue({
        id: 5, reviewComment: "Blurry", employee: { id: 1, legalFirstName: "Jo", legalLastName: "X", preferredFirstName: null, preferredLastName: null, User: null },
        submittedByUser: { id: "u1", email: "mgr@x", employeeId: 9 }, ticket: { ticketName: "Forklift" }, training: null,
      });
    mockPrisma.documentSubmission.update.mockResolvedValue({ id: 5 });

    await documentSubmissionService.sendBack(5, "Blurry", admin);

    expect(mockPrisma.documentSubmission.update.mock.calls[0][0].data).toMatchObject({
      status: "ChangesRequested", reviewComment: "Blurry", reviewedByUserId: "a1",
    });
    expect(enqueue).toHaveBeenCalledWith("SEND_EMAIL", expect.objectContaining({ to: ["mgr@x"] }));
  });
});
