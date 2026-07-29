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
    getSettings: vi
      .fn()
      .mockResolvedValue({ "tickets.expiryReminderDays": "365,180,90,30" }),
  },
}));

vi.mock("@/lib/services/emailTemplateService", () => ({
  emailTemplateService: {
    render: vi.fn().mockResolvedValue({ subject: "s", body: "b" }),
  },
}));

const { resolveExpiryRecipients } = vi.hoisted(() => ({
  resolveExpiryRecipients: vi.fn(),
}));
vi.mock("@/lib/services/expiryNotificationRecipients", () => ({
  resolveExpiryRecipients,
}));

import { ticketExpiryHandler } from "@/lib/jobs/handlers/ticketExpiry";

const DAY = 24 * 60 * 60 * 1000;
const ticket = { ticketName: "WHS" };
const holder = { legalFirstName: "Jo", legalLastName: "X" };

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.ticketRecords.update.mockResolvedValue({});
  resolveExpiryRecipients.mockResolvedValue({ to: ["mgr@x"], cc: [] });
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

  it("case 2: expiring soon (5 days), stage null → email + stage '30', no cache invalidate", async () => {
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
      data: { expiryNotificationStage: "30" },
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

  it("case 5: 200 days out → 1-year milestone (stage '365')", async () => {
    const rec = {
      id: 6, employeeId: 14, ticketId: 104,
      expiryDate: new Date(Date.now() + 200 * DAY),
      dateIssued: new Date(Date.now() - 100 * DAY),
      expiryNotificationStage: null, ticket, ticketHolder: holder,
    };
    mockPrisma.ticketRecords.findMany
      .mockResolvedValueOnce([rec])
      .mockResolvedValueOnce([rec]);

    const result = await ticketExpiryHandler({});

    expect(mockPrisma.ticketRecords.update).toHaveBeenCalledWith({
      where: { id: 6 },
      data: { expiryNotificationStage: "365" },
    });
    expect(result).toEqual({ warned: 1, expired: 0 });
  });

  it("case 6: already reminded at a nearer milestone (stage '30', 5 days out) → no re-send", async () => {
    const rec = {
      id: 7, employeeId: 15, ticketId: 105,
      expiryDate: new Date(Date.now() + 5 * DAY),
      dateIssued: new Date(Date.now() - 360 * DAY),
      expiryNotificationStage: "30", ticket, ticketHolder: holder,
    };
    mockPrisma.ticketRecords.findMany
      .mockResolvedValueOnce([rec])
      .mockResolvedValueOnce([rec]);

    const result = await ticketExpiryHandler({});

    expect(enqueue).not.toHaveBeenCalled();
    expect(mockPrisma.ticketRecords.update).not.toHaveBeenCalled();
    expect(result).toEqual({ warned: 0, expired: 0 });
  });

  it("case 7: crossing into a nearer milestone (stage '365', 100 days out) → re-send at '180'", async () => {
    const rec = {
      id: 8, employeeId: 16, ticketId: 106,
      expiryDate: new Date(Date.now() + 100 * DAY),
      dateIssued: new Date(Date.now() - 300 * DAY),
      expiryNotificationStage: "365", ticket, ticketHolder: holder,
    };
    mockPrisma.ticketRecords.findMany
      .mockResolvedValueOnce([rec])
      .mockResolvedValueOnce([rec]);

    const result = await ticketExpiryHandler({});

    expect(enqueue).toHaveBeenCalledWith("SEND_EMAIL", expect.objectContaining({ to: ["mgr@x"] }));
    expect(mockPrisma.ticketRecords.update).toHaveBeenCalledWith({
      where: { id: 8 },
      data: { expiryNotificationStage: "180" },
    });
    expect(result).toEqual({ warned: 1, expired: 0 });
  });

  it("case 8: expiry beyond the furthest milestone (500 days) → nothing sent", async () => {
    const rec = {
      id: 9, employeeId: 17, ticketId: 107,
      expiryDate: new Date(Date.now() + 500 * DAY),
      dateIssued: new Date(Date.now() - 10 * DAY),
      expiryNotificationStage: null, ticket, ticketHolder: holder,
    };
    // The handler's query already excludes records past the horizon, so nothing
    // is returned in the window at all.
    mockPrisma.ticketRecords.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await ticketExpiryHandler({});

    expect(enqueue).not.toHaveBeenCalled();
    expect(result).toEqual({ warned: 0, expired: 0 });
    // Sanity: the query cutoff is the 365-day horizon, not 500+.
    const where = mockPrisma.ticketRecords.findMany.mock.calls[0][0].where;
    const cutoff: Date = where.expiryDate.lte;
    expect(cutoff.getTime()).toBeLessThan(Date.now() + 400 * DAY);
    void rec;
  });

  it("case 9: legacy 'WarnSent' stage re-warns once at the correct milestone", async () => {
    const rec = {
      id: 10, employeeId: 18, ticketId: 108,
      expiryDate: new Date(Date.now() + 5 * DAY),
      dateIssued: new Date(Date.now() - 360 * DAY),
      expiryNotificationStage: "WarnSent", ticket, ticketHolder: holder,
    };
    mockPrisma.ticketRecords.findMany
      .mockResolvedValueOnce([rec])
      .mockResolvedValueOnce([rec]);

    const result = await ticketExpiryHandler({});

    expect(mockPrisma.ticketRecords.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { expiryNotificationStage: "30" },
    });
    expect(result).toEqual({ warned: 1, expired: 0 });
  });

  it("case 10: batching — same recipients across two employees → one consolidated email", async () => {
    const recA = {
      id: 20, employeeId: 30, ticketId: 200,
      expiryDate: new Date(Date.now() + 5 * DAY),
      dateIssued: new Date(Date.now() - 360 * DAY),
      expiryNotificationStage: null, ticket,
      ticketHolder: { legalFirstName: "Aa", legalLastName: "One" },
    };
    const recB = {
      id: 21, employeeId: 31, ticketId: 201,
      expiryDate: new Date(Date.now() + 10 * DAY),
      dateIssued: new Date(Date.now() - 360 * DAY),
      expiryNotificationStage: null, ticket,
      ticketHolder: { legalFirstName: "Bb", legalLastName: "Two" },
    };
    resolveExpiryRecipients.mockResolvedValue({ to: ["mgr@x"], cc: ["admin@x"] });
    mockPrisma.ticketRecords.findMany
      .mockResolvedValueOnce([recA, recB])
      .mockResolvedValueOnce([recA, recB]);

    const result = await ticketExpiryHandler({});

    const emailCalls = enqueue.mock.calls.filter((c) => c[0] === "SEND_EMAIL");
    expect(emailCalls).toHaveLength(1);
    expect(emailCalls[0][1]).toMatchObject({ to: ["mgr@x"], cc: ["admin@x"] });
    expect(result).toEqual({ warned: 2, expired: 0 });
  });

  it("case 11: batching — different recipient sets → separate emails", async () => {
    const recA = {
      id: 22, employeeId: 32, ticketId: 202,
      expiryDate: new Date(Date.now() + 5 * DAY),
      dateIssued: new Date(Date.now() - 360 * DAY),
      expiryNotificationStage: null, ticket, ticketHolder: holder,
    };
    const recB = {
      id: 23, employeeId: 33, ticketId: 203,
      expiryDate: new Date(Date.now() + 5 * DAY),
      dateIssued: new Date(Date.now() - 360 * DAY),
      expiryNotificationStage: null, ticket, ticketHolder: holder,
    };
    resolveExpiryRecipients.mockImplementation((employeeId: number) =>
      Promise.resolve(
        employeeId === 32 ? { to: ["a@x"], cc: [] } : { to: ["b@x"], cc: [] },
      ),
    );
    mockPrisma.ticketRecords.findMany
      .mockResolvedValueOnce([recA, recB])
      .mockResolvedValueOnce([recA, recB]);

    const result = await ticketExpiryHandler({});

    const emailCalls = enqueue.mock.calls.filter((c) => c[0] === "SEND_EMAIL");
    expect(emailCalls).toHaveLength(2);
    expect(result).toEqual({ warned: 2, expired: 0 });
  });
});
