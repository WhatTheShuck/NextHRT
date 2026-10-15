import { describe, it, expect, vi, beforeEach } from "vitest";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-10-09T00:00:00.000Z");

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    employee: { findMany: vi.fn() },
    ticketRecords: { findMany: vi.fn() },
    documentSubmission: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

const { getEmployeeIdsInScope } = vi.hoisted(() => ({ getEmployeeIdsInScope: vi.fn() }));
vi.mock("@/lib/services/employeeScopeService", () => ({
  getEmployeeIdsInScope,
  scopeWhere: (s: any) => (s === "all" ? {} : { id: { in: s } }),
}));
const { findMissingItems } = vi.hoisted(() => ({ findMissingItems: vi.fn() }));
vi.mock("@/lib/services/missingItems", () => ({ findMissingItems }));
const { getSettings } = vi.hoisted(() => ({ getSettings: vi.fn() }));
vi.mock("@/lib/services/appSettingService", () => ({ appSettingService: { getSettings } }));

import { documentStatusService } from "@/lib/services/documentStatusService";

const emp = { id: 1, legalFirstName: "Jo", legalLastName: "X", preferredFirstName: null, preferredLastName: null, department: { name: "Service" } };
const rec = (id: number, ticketId: number, offsetDays: number | null) => ({
  id, employeeId: 1, ticketId, dateIssued: new Date("2020-01-01"),
  expiryDate: offsetDays === null ? null : new Date(now.getTime() + offsetDays * DAY),
  ticket: { ticketName: `T${ticketId}` },
});

const sub9 = {
  id: 9, employeeId: 1, kind: "Ticket", ticketId: 10, trainingId: null, status: "Pending",
  createdAt: now, reviewComment: null, submittedByUserId: "u1",
  employee: emp, ticket: { ticketName: "T10" }, training: null, submittedByUser: { name: "Jo X" },
};

beforeEach(() => {
  vi.clearAllMocks();
  getEmployeeIdsInScope.mockResolvedValue([1]);
  getSettings.mockResolvedValue({ "tickets.expiryReminderDays": "90,30", "tickets.managerExpiryReminderDays": "30" });
  mockPrisma.employee.findMany.mockResolvedValue([emp]);
  mockPrisma.ticketRecords.findMany.mockResolvedValue([
    rec(1, 10, 20),     // expiring (≤30)
    rec(2, 11, 60),     // expiring (≤90)
    rec(3, 12, 200),    // beyond window
    rec(4, 13, -5),     // expired
    rec(5, 14, -400), rec(6, 14, 300), // renewed — old one ignored, new one beyond window
    rec(7, 15, null),   // never expires
    rec(8, 20, 30),     // badge boundary: counts
    rec(9, 21, 31),     // badge boundary: listed, doesn't count
    rec(10, 22, 90),    // window boundary: listed
    rec(11, 23, 91),    // window boundary: not listed
    rec(12, 24, 0),     // expiry exactly now: expired
  ]);
  findMissingItems.mockResolvedValue([{ employeeId: 1, kind: "Ticket", itemId: 16, itemName: "T16", reason: "NotProvided" }]);
  mockPrisma.documentSubmission.findMany.mockResolvedValue([sub9]);
});

describe("documentStatusService.getStatus", () => {
  it("splits current records into expiring/expired, adds missing and open-submission chips", async () => {
    const s = await documentStatusService.getStatus({ userId: "u1", role: "User" }, {}, now);

    expect(s.expiring.map((r) => [r.itemId, r.days])).toEqual([[10, 20], [20, 30], [21, 31], [11, 60], [22, 90]]);
    expect(s.expiring[0].open).toEqual({ id: 9, status: "Pending", isMine: true });
    expect(s.expired.map((r) => [r.itemId, r.days])).toEqual([[24, 0], [13, -5]]);
    expect(s.missing.map((r) => r.itemId)).toEqual([16]);
    expect(s.submitted.map((r) => r.id)).toEqual([9]);
    expect(s.reviewQueue).toBeNull();
    expect(s.windowDays).toBe(90); // the furthest employee milestone ("90,30")
  });

  it("marks a chip isMine: false when someone else submitted it", async () => {
    mockPrisma.documentSubmission.findMany.mockResolvedValue([
      sub9,
      { ...sub9, id: 8, ticketId: 11, ticket: { ticketName: "T11" }, status: "ChangesRequested", submittedByUserId: "u2" },
    ]);
    const s = await documentStatusService.getStatus({ userId: "u1", role: "User" }, {}, now);
    expect(s.expiring.find((r) => r.itemId === 11)?.open).toEqual({ id: 8, status: "ChangesRequested", isMine: false });
    expect(s.submitted.find((r) => r.id === 8)?.isMine).toBe(false);
  });

  it("queries active in-View-scope employees, active tickets, and Approved submissions from the last 30 days", async () => {
    await documentStatusService.getStatus({ userId: "u1", role: "User" }, {}, now);

    expect(getEmployeeIdsInScope).toHaveBeenCalledWith("u1", "User", { level: "View" });
    const employeeWhere = mockPrisma.employee.findMany.mock.lastCall![0].where;
    expect(employeeWhere.isActive).toBe(true);
    expect(employeeWhere.AND).toContainEqual({ id: { in: [1] } });

    const recWhere = mockPrisma.ticketRecords.findMany.mock.lastCall![0].where;
    expect(recWhere.ticket).toEqual({ isActive: true });
    expect(recWhere.ticketHolder).toEqual(employeeWhere);

    const subWhere = mockPrisma.documentSubmission.findMany.mock.lastCall![0].where;
    const approved = subWhere.AND[1].OR.find((o: { status: unknown }) => o.status === "Approved");
    expect(approved.reviewedAt.gte).toEqual(new Date(now.getTime() - 30 * DAY));
  });

  it("applies the employee/department filters to the viewer's own submissions too", async () => {
    await documentStatusService.getStatus({ userId: "u1", role: "User" }, { employeeId: 2, departmentId: 5 }, now);

    const employeeWhere = mockPrisma.employee.findMany.mock.lastCall![0].where;
    const subWhere = mockPrisma.documentSubmission.findMany.mock.lastCall![0].where;
    // The own branch is narrowed by the filters only (no scope, no isActive), so the viewer's
    // submission for another employee (say id 3) is excluded once employeeId 2 is chosen.
    expect(subWhere.AND[0].OR).toEqual([
      { employee: employeeWhere },
      { submittedByUserId: "u1", employee: { id: 2, departmentId: 5 } },
    ]);
  });

  it("without filters the own branch is not narrowed", async () => {
    await documentStatusService.getStatus({ userId: "u1", role: "User" }, {}, now);
    const subWhere = mockPrisma.documentSubmission.findMany.mock.lastCall![0].where;
    expect(subWhere.AND[0].OR[1]).toEqual({ submittedByUserId: "u1", employee: {} });
  });

  it("windowDays is the furthest milestone on either track", async () => {
    getSettings.mockResolvedValue({ "tickets.expiryReminderDays": "60,30", "tickets.managerExpiryReminderDays": "100" });
    const s = await documentStatusService.getStatus({ userId: "u1", role: "User" }, {}, now);
    expect(s.windowDays).toBe(100);
    expect(s.expiring.map((r) => r.itemId)).toContain(22); // 90 days out, inside the manager window
  });

  it("canAct marks rows whose employee is in the viewer's Act scope", async () => {
    const emp2 = { ...emp, id: 2, legalFirstName: "Al" };
    getEmployeeIdsInScope.mockImplementation(async (_u: string, _r: string, { level }: { level: string }) =>
      level === "Act" ? [1] : [1, 2],
    );
    mockPrisma.employee.findMany.mockResolvedValue([emp, emp2]);
    mockPrisma.ticketRecords.findMany.mockResolvedValue([rec(1, 10, 20), { ...rec(2, 11, -3), employeeId: 2 }]);
    findMissingItems.mockResolvedValue([
      { employeeId: 1, kind: "Ticket", itemId: 16, itemName: "T16", reason: "NotProvided" },
      { employeeId: 2, kind: "Training", itemId: 17, itemName: "X17", reason: "NotProvided" },
    ]);
    const s = await documentStatusService.getStatus({ userId: "u1", role: "User" }, {}, now);
    expect(getEmployeeIdsInScope).toHaveBeenCalledWith("u1", "User", { level: "Act" });
    expect(s.expiring.map((r) => [r.employeeId, r.canAct])).toEqual([[1, true]]);
    expect(s.expired.map((r) => [r.employeeId, r.canAct])).toEqual([[2, false]]);
    expect(s.missing.map((r) => [r.employeeId, r.canAct])).toEqual([[1, true], [2, false]]);
  });

  it("canAct is true for everyone when the Act scope is all", async () => {
    getEmployeeIdsInScope.mockResolvedValue("all");
    const s = await documentStatusService.getStatus({ userId: "a", role: "Admin" }, {}, now);
    expect([...s.expiring, ...s.expired, ...s.missing].every((r) => r.canAct)).toBe(true);
  });

  it("admins get the review queue", async () => {
    getEmployeeIdsInScope.mockResolvedValue("all");
    const s = await documentStatusService.getStatus({ userId: "a", role: "Admin" }, {}, now);
    expect(s.reviewQueue?.map((r) => r.id)).toEqual([9]);
  });
});

describe("documentStatusService.count", () => {
  it("employee/manager: expired + missing + expiring within 30 days, minus items with a Pending upload", async () => {
    // 24, 13 + 16 + 20; item 10 has Pending upload 9, so the employee has already acted.
    expect(await documentStatusService.count({ userId: "u1", role: "User" }, now)).toEqual({ count: 4, reviewCount: 0 });
  });
  it("a sent-back upload still counts: the employee has to act again", async () => {
    mockPrisma.documentSubmission.findMany.mockResolvedValue([{ ...sub9, status: "ChangesRequested" }]);
    expect(await documentStatusService.count({ userId: "u1", role: "User" }, now)).toEqual({ count: 5, reviewCount: 0 });
  });
  it("admin: expiring within 30 days (long-expired items don't count); reviews counted separately", async () => {
    getEmployeeIdsInScope.mockResolvedValue("all");
    // item 20 (item 10 has a Pending upload); review queue: 9
    expect(await documentStatusService.count({ userId: "a", role: "Admin" }, now)).toEqual({ count: 1, reviewCount: 1 });
  });
});
