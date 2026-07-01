import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    ticketRecords: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  };
  return { mockPrisma };
});

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

const { enqueue } = vi.hoisted(() => ({ enqueue: vi.fn() }));
vi.mock("@/lib/jobs/jobQueue", () => ({ enqueue }));

vi.mock("@/lib/services/appSettingService", () => ({
  appSettingService: {
    getSettings: vi.fn().mockResolvedValue({ "tickets.expiryWarningDays": "30" }),
  },
}));

vi.mock("@/lib/services/emailTemplateService", () => ({
  emailTemplateService: {
    render: vi.fn().mockResolvedValue({ subject: "s", body: "b" }),
  },
}));

vi.mock("@/lib/services/expiryNotificationRecipients", () => ({
  resolveExpiryRecipients: vi.fn().mockResolvedValue({ to: ["mgr@x"], cc: [] }),
}));

import { ticketExpiryHandler } from "@/lib/jobs/handlers/ticketExpiry";

const DAY = 24 * 60 * 60 * 1000;
const ticket = { ticketName: "WHS" };
const holder = { legalFirstName: "Jo", legalLastName: "X" };

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.ticketRecords.update.mockResolvedValue({});
});

describe("ticketExpiryHandler", () => {
  it("case 1: newly expired current record → invalidate + email + ExpiredSent", async () => {
    const past = new Date(Date.now() - 10 * DAY);
    const rec = {
      id: 1, employeeId: 10, ticketId: 100,
      expiryDate: past, dateIssued: new Date(Date.now() - 400 * DAY),
      expiryNotificationStage: null, ticket, ticketHolder: holder,
    };
    mockPrisma.ticketRecords.findMany
      .mockResolvedValueOnce([rec]) // records in window
      .mockResolvedValueOnce([rec]); // allForPairs

    const result = await ticketExpiryHandler({});

    expect(enqueue).toHaveBeenCalledWith("REQUIREMENTS_CACHE_INVALIDATE", { employeeId: 10 });
    expect(enqueue).toHaveBeenCalledWith("SEND_EMAIL", expect.objectContaining({ to: ["mgr@x"] }));
    expect(mockPrisma.ticketRecords.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { expiryNotificationStage: "ExpiredSent" },
    });
    expect(result).toEqual({ warned: 0, expired: 1 });
  });

  it("case 2: expiring soon, stage null → email + WarnSent, no cache invalidate", async () => {
    const soon = new Date(Date.now() + 5 * DAY);
    const rec = {
      id: 2, employeeId: 11, ticketId: 101,
      expiryDate: soon, dateIssued: new Date(Date.now() - 360 * DAY),
      expiryNotificationStage: null, ticket, ticketHolder: holder,
    };
    mockPrisma.ticketRecords.findMany
      .mockResolvedValueOnce([rec])
      .mockResolvedValueOnce([rec]);

    const result = await ticketExpiryHandler({});

    expect(enqueue).toHaveBeenCalledWith("SEND_EMAIL", expect.objectContaining({ to: ["mgr@x"] }));
    expect(enqueue).not.toHaveBeenCalledWith("REQUIREMENTS_CACHE_INVALIDATE", expect.anything());
    expect(mockPrisma.ticketRecords.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { expiryNotificationStage: "WarnSent" },
    });
    expect(result).toEqual({ warned: 1, expired: 0 });
  });

  it("case 3: already ExpiredSent → no enqueue, no update (idempotent)", async () => {
    const past = new Date(Date.now() - 10 * DAY);
    const rec = {
      id: 3, employeeId: 12, ticketId: 102,
      expiryDate: past, dateIssued: new Date(Date.now() - 400 * DAY),
      expiryNotificationStage: "ExpiredSent", ticket, ticketHolder: holder,
    };
    mockPrisma.ticketRecords.findMany
      .mockResolvedValueOnce([rec])
      .mockResolvedValueOnce([rec]);

    const result = await ticketExpiryHandler({});

    expect(enqueue).not.toHaveBeenCalled();
    expect(mockPrisma.ticketRecords.update).not.toHaveBeenCalled();
    expect(result).toEqual({ warned: 0, expired: 0 });
  });

  it("case 4: superseded expired record (newer valid record exists) is not processed", async () => {
    const past = new Date(Date.now() - 10 * DAY);
    const expiredOld = {
      id: 4, employeeId: 13, ticketId: 103,
      expiryDate: past, dateIssued: new Date(Date.now() - 400 * DAY),
      expiryNotificationStage: null, ticket, ticketHolder: holder,
    };
    const newerValid = {
      id: 5, employeeId: 13, ticketId: 103,
      expiryDate: new Date("2099-01-01"), dateIssued: new Date(Date.now() - 5 * DAY),
    };
    mockPrisma.ticketRecords.findMany
      .mockResolvedValueOnce([expiredOld]) // only the expired one falls in the window
      .mockResolvedValueOnce([expiredOld, newerValid]); // both for the pair

    const result = await ticketExpiryHandler({});

    expect(enqueue).not.toHaveBeenCalled();
    expect(mockPrisma.ticketRecords.update).not.toHaveBeenCalled();
    expect(result).toEqual({ warned: 0, expired: 0 });
  });
});
