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
const { getSettings } = vi.hoisted(() => ({ getSettings: vi.fn() }));
vi.mock("@/lib/services/appSettingService", () => ({ appSettingService: { getSettings } }));
const { render } = vi.hoisted(() => ({ render: vi.fn() }));
vi.mock("@/lib/services/emailTemplateService", () => ({
  emailTemplateService: { render, renderList: vi.fn().mockResolvedValue("<ul></ul>") },
}));
const { findMissingItems } = vi.hoisted(() => ({ findMissingItems: vi.fn() }));
vi.mock("@/lib/services/missingItems", () => ({ findMissingItems }));

import { missingDocumentReminderHandler } from "@/lib/jobs/handlers/missingDocumentReminder";

const gap = { employeeId: 1, kind: "Ticket", itemId: 10, itemName: "White Card", reason: "NotProvided" };
const row = (over: Record<string, unknown> = {}) => ({ id: 50, employeeId: 1, itemType: "Ticket", itemId: 10, firstNotifiedAt: null, lastNotifiedAt: null, ...over });

// documentSubmission.findMany honours its `status` filter, so the tests check what is suppressed.
function givenSubmissions(subs: { employeeId: number; kind: string; ticketId: number | null; trainingId: number | null; status: string }[]) {
  mockPrisma.documentSubmission.findMany.mockImplementation(async ({ where }: any) =>
    subs.filter((s) => (typeof where.status === "string" ? s.status === where.status : where.status.in.includes(s.status))),
  );
}

beforeEach(() => {
  getSettings.mockResolvedValue({ "documents.missingReminderIntervalDays": "30" });
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
    const listed = { employeeId: 1, OR: [{ itemType: "Ticket", itemId: 10 }] };
    expect(mockPrisma.missingDocumentReminder.updateMany).toHaveBeenCalledWith({
      where: { ...listed, firstNotifiedAt: null },
      data: { firstNotifiedAt: expect.any(Date) },
    });
    expect(mockPrisma.missingDocumentReminder.updateMany).toHaveBeenCalledWith({
      where: listed,
      data: { lastNotifiedAt: expect.any(Date) },
    });
  });

  it("notified 10 days ago: not due", async () => {
    mockPrisma.missingDocumentReminder.findMany.mockResolvedValue([
      row({ firstNotifiedAt: new Date(Date.now() - 40 * DAY), lastNotifiedAt: new Date(Date.now() - 10 * DAY) }),
    ]);
    const result = await missingDocumentReminderHandler({});
    expect(enqueue).not.toHaveBeenCalled();
    expect(result.emailed).toBe(0);
  });

  it("notified 31 days ago: monthly digest", async () => {
    mockPrisma.missingDocumentReminder.findMany.mockResolvedValue([
      row({ firstNotifiedAt: new Date(Date.now() - 61 * DAY), lastNotifiedAt: new Date(Date.now() - 31 * DAY) }),
    ]);
    await missingDocumentReminderHandler({});
    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  it("a Pending submission keeps the row but suppresses the send", async () => {
    mockPrisma.missingDocumentReminder.findMany.mockResolvedValue([row()]);
    givenSubmissions([{ employeeId: 1, kind: "Ticket", ticketId: 10, trainingId: null, status: "Pending" }]);

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

  it("a sent-back (ChangesRequested) submission doesn't suppress the send", async () => {
    mockPrisma.missingDocumentReminder.findMany.mockResolvedValue([row()]);
    givenSubmissions([{ employeeId: 1, kind: "Ticket", ticketId: 10, trainingId: null, status: "ChangesRequested" }]);

    await missingDocumentReminderHandler({});

    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  it("two gaps for one employee: one digest with count 2", async () => {
    findMissingItems.mockResolvedValue([gap, { ...gap, kind: "Training", itemId: 20, itemName: "First Aid" }]);

    await missingDocumentReminderHandler({});

    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(render).toHaveBeenCalledWith("document.missing", expect.objectContaining({ count: 2 }));
  });

  it("a linked employee gets their login address and no note", async () => {
    mockPrisma.employee.findMany.mockResolvedValue([
      { id: 1, legalFirstName: "Jo", legalLastName: "X", preferredFirstName: null, preferredLastName: null, User: { email: "jo@corp" } },
    ]);

    await missingDocumentReminderHandler({});

    expect(enqueue).toHaveBeenCalledWith("SEND_EMAIL", expect.objectContaining({ to: "jo@corp" }));
    expect(render).toHaveBeenCalledWith("document.missing", expect.objectContaining({ unlinkedNote: "" }));
  });

  it("a linked user without an email gets the built address and the note", async () => {
    mockPrisma.employee.findMany.mockResolvedValue([
      { id: 1, legalFirstName: "Jo", legalLastName: "X", preferredFirstName: null, preferredLastName: null, User: { email: null } },
    ]);

    await missingDocumentReminderHandler({});

    expect(render).toHaveBeenCalledWith("document.missing", expect.objectContaining({ unlinkedNote: expect.stringMatching(/manager/) }));
  });

  it("honours the interval setting", async () => {
    getSettings.mockResolvedValue({ "documents.missingReminderIntervalDays": "7" });
    const notified = (daysAgo: number) =>
      row({ firstNotifiedAt: new Date(Date.now() - 40 * DAY), lastNotifiedAt: new Date(Date.now() - daysAgo * DAY) });

    mockPrisma.missingDocumentReminder.findMany.mockResolvedValue([notified(6)]);
    await missingDocumentReminderHandler({});
    expect(enqueue).not.toHaveBeenCalled();

    mockPrisma.missingDocumentReminder.findMany.mockResolvedValue([notified(8)]);
    await missingDocumentReminderHandler({});
    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  it("switched off with two employees due: sends nothing, marks nothing", async () => {
    render.mockResolvedValue(null);
    findMissingItems.mockResolvedValue([gap, { ...gap, employeeId: 2 }]);
    mockPrisma.employee.findMany.mockResolvedValue([
      { id: 1, legalFirstName: "Jo", legalLastName: "X", preferredFirstName: null, preferredLastName: null, User: null },
      { id: 2, legalFirstName: "Al", legalLastName: "Y", preferredFirstName: null, preferredLastName: null, User: null },
    ]);

    await missingDocumentReminderHandler({});

    expect(enqueue).not.toHaveBeenCalled();
    expect(mockPrisma.missingDocumentReminder.updateMany).not.toHaveBeenCalled();
  });
});
