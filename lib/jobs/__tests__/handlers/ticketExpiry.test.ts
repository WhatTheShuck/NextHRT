import { describe, it, expect, vi, beforeEach } from "vitest";

const DAY = 24 * 60 * 60 * 1000;

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    ticketRecords: { findMany: vi.fn(), update: vi.fn() },
    documentSubmission: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

const { enqueue } = vi.hoisted(() => ({ enqueue: vi.fn() }));
vi.mock("@/lib/jobs/jobQueue", () => ({ enqueue }));
vi.mock("@/lib/data", () => ({ companyDetails: { domain_extension: "ksb.com.au" } }));
vi.mock("@/lib/services/appSettingService", () => ({
  appSettingService: {
    getSettings: vi.fn().mockResolvedValue({
      "tickets.expiryReminderDays": "365,180,90,30",
      "tickets.managerExpiryReminderDays": "30",
    }),
  },
}));

const { render, renderList } = vi.hoisted(() => ({
  render: vi.fn(),
  renderList: vi.fn(),
}));
vi.mock("@/lib/services/emailTemplateService", () => ({ emailTemplateService: { render, renderList } }));

const { resolveExpiryRecipients } = vi.hoisted(() => ({ resolveExpiryRecipients: vi.fn() }));
vi.mock("@/lib/services/expiryNotificationRecipients", () => ({ resolveExpiryRecipients }));

import { appSettingService } from "@/lib/services/appSettingService";
import { ticketExpiryHandler } from "@/lib/jobs/handlers/ticketExpiry";

const linked = { id: 10, legalFirstName: "Jo", legalLastName: "X", preferredFirstName: null, preferredLastName: null, User: { email: "jo@x" } };
const unlinked = { ...linked, id: 11, legalFirstName: "Sam", legalLastName: "Lee", User: null };
const record = (over: Record<string, unknown>) => ({
  id: 1, employeeId: 10, ticketId: 100, dateIssued: new Date(Date.now() - 400 * DAY),
  expiryDate: new Date(Date.now() + 20 * DAY),
  expiryNotificationStage: null, managerExpiryNotificationStage: null,
  ticket: { ticketName: "Forklift" }, ticketHolder: linked, ...over,
});
const sends = () => enqueue.mock.calls.filter((c) => c[0] === "SEND_EMAIL").map((c) => c[1]);

function given(records: any[], pending: any[] = []) {
  mockPrisma.ticketRecords.findMany.mockResolvedValueOnce(records).mockResolvedValueOnce(records);
  mockPrisma.documentSubmission.findMany.mockResolvedValue(pending);
}

beforeEach(() => {
  mockPrisma.ticketRecords.findMany.mockReset();
  enqueue.mockReset();
  render.mockImplementation(async (key: string, vars: any) => ({ subject: key, body: JSON.stringify(vars) }));
  renderList.mockResolvedValue("<ul></ul>");
  resolveExpiryRecipients.mockResolvedValue({ to: ["mgr@x"] });
  mockPrisma.ticketRecords.update.mockResolvedValue({});
});

describe("ticketExpiryHandler", () => {
  it("newly expired: invalidates cache, emails employee and managers, both tracks ExpiredSent", async () => {
    given([record({ expiryDate: new Date(Date.now() - 2 * DAY) })]);

    await ticketExpiryHandler({});

    expect(enqueue).toHaveBeenCalledWith("REQUIREMENTS_CACHE_INVALIDATE", { employeeId: 10 });
    expect(sends().map((s) => s.to)).toEqual(["jo@x", ["mgr@x"]]); // employee digest first, then managers
    expect(sends().every((s) => s.cc === undefined)).toBe(true); // no admin CC
    expect(mockPrisma.ticketRecords.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { expiryNotificationStage: "ExpiredSent", managerExpiryNotificationStage: "ExpiredSent" },
    });
  });

  it("80 days out: employee gets the 90-day reminder, managers hear nothing yet", async () => {
    given([record({ expiryDate: new Date(Date.now() + 80 * DAY) })]);

    await ticketExpiryHandler({});

    expect(sends().map((s) => s.to)).toEqual(["jo@x"]);
    expect(mockPrisma.ticketRecords.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { expiryNotificationStage: "90" } });
  });

  it("20 days out after the 90 reminder: employee 30, manager 30", async () => {
    given([record({ expiryNotificationStage: "90" })]);

    await ticketExpiryHandler({});

    expect(sends()).toHaveLength(2);
    expect(mockPrisma.ticketRecords.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { expiryNotificationStage: "30", managerExpiryNotificationStage: "30" },
    });
  });

  it("a Pending renewal pauses the employee track (stage not advanced) but not the manager track", async () => {
    given([record({})], [{ employeeId: 10, ticketId: 100 }]);

    await ticketExpiryHandler({});

    expect(sends().map((s) => s.to)).toEqual([["mgr@x"]]);
    expect(mockPrisma.ticketRecords.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { managerExpiryNotificationStage: "30" } });
  });

  it("already ExpiredSent on both tracks: nothing", async () => {
    given([record({ expiryDate: new Date(Date.now() - 2 * DAY), expiryNotificationStage: "ExpiredSent", managerExpiryNotificationStage: "ExpiredSent" })]);

    await ticketExpiryHandler({});

    expect(enqueue).not.toHaveBeenCalled();
    expect(mockPrisma.ticketRecords.update).not.toHaveBeenCalled();
  });

  it("a superseded record is skipped", async () => {
    const old = record({ id: 1, expiryDate: new Date(Date.now() - 2 * DAY) });
    const renewed = record({ id: 2, expiryDate: new Date(Date.now() + 1000 * DAY) });
    mockPrisma.ticketRecords.findMany.mockResolvedValueOnce([old]).mockResolvedValueOnce([old, renewed]);
    mockPrisma.documentSubmission.findMany.mockResolvedValue([]);

    await ticketExpiryHandler({});

    expect(mockPrisma.ticketRecords.update).not.toHaveBeenCalled();
  });

  it("one employee email per employee listing all their tickets; unlinked staff get the built address and the note", async () => {
    given([
      record({ id: 1, ticketId: 100, ticketHolder: unlinked, employeeId: 11 }),
      record({ id: 2, ticketId: 101, ticketHolder: unlinked, employeeId: 11, expiryDate: new Date(Date.now() - DAY) }),
    ]);

    await ticketExpiryHandler({});

    const employeeSends = sends().filter((s) => s.subject === "document.employeeExpiry");
    expect(employeeSends).toHaveLength(1);
    expect(employeeSends[0].to).toBe("sam.lee@ksb.com.au");
    expect(JSON.parse(employeeSends[0].html).unlinkedNote).toMatch(/manager/);
    expect(renderList).toHaveBeenCalledWith("document.employeeExpiry", expect.arrayContaining([
      expect.objectContaining({ daysText: "expired" }),
      expect.objectContaining({ daysText: "expires in 20 days" }),
    ]));
  });

  it("a switched-off template skips that send but still records the stage", async () => {
    render.mockImplementation(async (key: string) => (key === "ticket.expiryWarning" ? null : { subject: key, body: "{}" }));
    given([record({ expiryNotificationStage: "90" })]);

    await ticketExpiryHandler({});

    expect(sends().map((s) => s.subject)).toEqual(["document.employeeExpiry"]);
    expect(mockPrisma.ticketRecords.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { expiryNotificationStage: "30", managerExpiryNotificationStage: "30" },
    });
  });

  it("only Pending submissions pause the employee track", async () => {
    given([record({})]);

    await ticketExpiryHandler({});

    expect(mockPrisma.documentSubmission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: "Pending", kind: "Ticket" }) }),
    );
  });

  it("two employees sharing a manager recipient set: one manager email listing both", async () => {
    given([
      record({ id: 1, expiryNotificationStage: "30" }),
      record({ id: 2, employeeId: 11, ticketHolder: unlinked, expiryNotificationStage: "30" }),
    ]);

    await ticketExpiryHandler({});

    expect(sends().filter((s) => s.subject === "ticket.expiryWarning")).toHaveLength(1);
    const managerRows = renderList.mock.calls.find((c) => c[0] === "ticket.expiryWarning")![1];
    expect(managerRows).toHaveLength(2);
  });

  it("no manager recipients: nothing is sent, but the manager stage still advances", async () => {
    resolveExpiryRecipients.mockResolvedValue({ to: [] });
    given([record({ expiryNotificationStage: "30" })]);

    await ticketExpiryHandler({});

    expect(sends()).toHaveLength(0);
    expect(mockPrisma.ticketRecords.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { managerExpiryNotificationStage: "30" } });
  });

  it("a failed employee digest keeps earlier digests' stages and leaves its own unwritten", async () => {
    enqueue.mockImplementation(async (type: string, payload: any) => {
      if (type === "SEND_EMAIL" && payload.to === "sam.lee@ksb.com.au") throw new Error("queue down");
    });
    given([
      record({ id: 1, expiryNotificationStage: "90" }),
      record({ id: 2, employeeId: 11, ticketHolder: unlinked, expiryNotificationStage: "90" }),
    ]);

    await expect(ticketExpiryHandler({})).rejects.toThrow("queue down");

    expect(sends().map((s) => s.to)).toEqual(["jo@x", "sam.lee@ksb.com.au"]); // jo enqueued, then sam failed
    const written = mockPrisma.ticketRecords.update.mock.calls.map(([arg]) => arg);
    expect(written).toContainEqual({ where: { id: 1 }, data: { expiryNotificationStage: "30" } });
    expect(written.some((w) => w.where.id === 2)).toBe(false);
  });

  it("a failing stage flush is logged and doesn't mask the send error", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    enqueue.mockImplementation(async (type: string, payload: any) => {
      if (type === "SEND_EMAIL" && payload.to === "sam.lee@ksb.com.au") throw new Error("queue down");
    });
    mockPrisma.ticketRecords.update.mockRejectedValue(new Error("db locked"));
    given([
      record({ id: 1, expiryNotificationStage: "90" }),
      record({ id: 2, employeeId: 11, ticketHolder: unlinked, expiryNotificationStage: "90" }),
    ]);

    await expect(ticketExpiryHandler({})).rejects.toThrow("queue down");
    expect(log).toHaveBeenCalledWith(expect.stringContaining("ticketExpiry"), expect.objectContaining({ message: "db locked" }));
    log.mockRestore();
  });

  it("a failing stage flush after clean sends still fails the run", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockPrisma.ticketRecords.update.mockRejectedValue(new Error("db locked"));
    given([record({ expiryNotificationStage: "90" })]);

    await expect(ticketExpiryHandler({})).rejects.toThrow("db locked");
    vi.mocked(console.error).mockRestore();
  });

  it("a linked user with no email still gets the unlinked note", async () => {
    given([record({ ticketHolder: { ...linked, User: { email: null } } })]);

    await ticketExpiryHandler({});

    const employeeSend = sends().find((s) => s.subject === "document.employeeExpiry");
    expect(employeeSend.to).toBe("jo.x@ksb.com.au");
    expect(JSON.parse(employeeSend.html).unlinkedNote).toMatch(/manager/);
  });

  it("unset milestones fall back to 90/60/30 for employees and 30 for managers", async () => {
    vi.mocked(appSettingService.getSettings).mockResolvedValueOnce({});
    given([record({ expiryDate: new Date(Date.now() + 75 * DAY) })]);

    await ticketExpiryHandler({});

    // 75 days out is inside 90 but outside 60: the 90-day employee reminder, nothing for managers yet.
    expect(sends().map((s) => s.to)).toEqual(["jo@x"]);
    expect(mockPrisma.ticketRecords.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { expiryNotificationStage: "90" } });
  });

  it("the default horizon stops at 90 days, not a year", async () => {
    vi.mocked(appSettingService.getSettings).mockResolvedValueOnce({});
    given([]);

    await ticketExpiryHandler({});

    const cutoff: Date = mockPrisma.ticketRecords.findMany.mock.calls[0][0].where.expiryDate.lte;
    expect(cutoff.getTime()).toBeLessThan(Date.now() + 91 * DAY);
    expect(cutoff.getTime()).toBeGreaterThan(Date.now() + 89 * DAY);
  });

  it("a stage left over from the retired 365-day reminder still reminds at 90", async () => {
    vi.mocked(appSettingService.getSettings).mockResolvedValueOnce({});
    given([record({ expiryDate: new Date(Date.now() + 80 * DAY), expiryNotificationStage: "365" })]);

    await ticketExpiryHandler({});

    expect(sends().map((s) => s.to)).toEqual(["jo@x"]);
    expect(mockPrisma.ticketRecords.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { expiryNotificationStage: "90" } });
  });
});
