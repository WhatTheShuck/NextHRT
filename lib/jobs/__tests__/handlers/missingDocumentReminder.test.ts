import { describe, it, expect, vi, beforeEach } from "vitest";

const DAY = 24 * 60 * 60 * 1000;

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    missingDocumentReminder: { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn(), updateMany: vi.fn() },
    documentSubmission: { findMany: vi.fn() },
    employee: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));
const { enqueue } = vi.hoisted(() => ({ enqueue: vi.fn() }));
vi.mock("@/lib/jobs/jobQueue", () => ({ enqueue }));
vi.mock("@/lib/data", () => ({ companyDetails: { domain_extension: "ksb.com.au" } }));
vi.mock("@/lib/services/appSettingService", () => ({
  appSettingService: { getSettings: vi.fn().mockResolvedValue({ "documents.missingReminderIntervalDays": "30" }) },
}));
const { render } = vi.hoisted(() => ({ render: vi.fn() }));
vi.mock("@/lib/services/emailTemplateService", () => ({
  emailTemplateService: { render, renderList: vi.fn().mockResolvedValue("<ul></ul>") },
}));
const { findMissingItems } = vi.hoisted(() => ({ findMissingItems: vi.fn() }));
vi.mock("@/lib/services/missingItems", () => ({ findMissingItems }));

import { missingDocumentReminderHandler } from "@/lib/jobs/handlers/missingDocumentReminder";

const gap = { employeeId: 1, kind: "Ticket", itemId: 10, itemName: "White Card", reason: "NotProvided" };
const row = (over: Record<string, unknown> = {}) => ({ id: 50, employeeId: 1, itemType: "Ticket", itemId: 10, firstNotifiedAt: null, lastNotifiedAt: null, ...over });

beforeEach(() => {
  render.mockResolvedValue({ subject: "s", body: "b" });
  findMissingItems.mockResolvedValue([gap]);
  mockPrisma.missingDocumentReminder.findMany.mockResolvedValue([]);
  mockPrisma.documentSubmission.findMany.mockResolvedValue([]);
  mockPrisma.employee.findMany.mockResolvedValue([
    { id: 1, legalFirstName: "Jo", legalLastName: "X", preferredFirstName: null, preferredLastName: null, User: null },
  ]);
});

describe("missingDocumentReminderHandler", () => {
  it("a new gap: creates the row and sends the first notice to the employee", async () => {
    await missingDocumentReminderHandler({});

    expect(findMissingItems).toHaveBeenCalledWith({ isActive: true });
    expect(mockPrisma.missingDocumentReminder.createMany).toHaveBeenCalledWith({
      data: [{ employeeId: 1, itemType: "Ticket", itemId: 10 }],
    });
    expect(enqueue).toHaveBeenCalledWith("SEND_EMAIL", expect.objectContaining({ to: "jo.x@ksb.com.au" }));
    expect(mockPrisma.missingDocumentReminder.updateMany).toHaveBeenCalled();
  });

  it("notified 10 days ago: not due", async () => {
    mockPrisma.missingDocumentReminder.findMany.mockResolvedValue([
      row({ firstNotifiedAt: new Date(Date.now() - 40 * DAY), lastNotifiedAt: new Date(Date.now() - 10 * DAY) }),
    ]);
    await missingDocumentReminderHandler({});
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("notified 31 days ago: monthly digest", async () => {
    mockPrisma.missingDocumentReminder.findMany.mockResolvedValue([
      row({ firstNotifiedAt: new Date(Date.now() - 61 * DAY), lastNotifiedAt: new Date(Date.now() - 31 * DAY) }),
    ]);
    await missingDocumentReminderHandler({});
    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  it("an open submission keeps the row but suppresses the send", async () => {
    mockPrisma.missingDocumentReminder.findMany.mockResolvedValue([row()]);
    mockPrisma.documentSubmission.findMany.mockResolvedValue([{ employeeId: 1, kind: "Ticket", ticketId: 10, trainingId: null }]);

    await missingDocumentReminderHandler({});

    expect(mockPrisma.missingDocumentReminder.deleteMany).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("a closed gap's row is deleted (only rows of active employees are considered)", async () => {
    findMissingItems.mockResolvedValue([]);
    mockPrisma.missingDocumentReminder.findMany.mockResolvedValue([row()]);

    await missingDocumentReminderHandler({});

    expect(mockPrisma.missingDocumentReminder.findMany).toHaveBeenCalledWith({ where: { employee: { isActive: true } } });
    expect(mockPrisma.missingDocumentReminder.deleteMany).toHaveBeenCalledWith({ where: { id: { in: [50] } } });
  });

  it("a switched-off template sends nothing and marks nothing as notified", async () => {
    render.mockResolvedValue(null);
    await missingDocumentReminderHandler({});
    expect(enqueue).not.toHaveBeenCalled();
    expect(mockPrisma.missingDocumentReminder.updateMany).not.toHaveBeenCalled();
  });
});
