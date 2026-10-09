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
vi.mock("@/lib/services/appSettingService", () => ({
  appSettingService: { getSettings: vi.fn().mockResolvedValue({ "tickets.expiryReminderDays": "90,30" }) },
}));

import { documentStatusService } from "@/lib/services/documentStatusService";

const emp = { id: 1, legalFirstName: "Jo", legalLastName: "X", preferredFirstName: null, preferredLastName: null, department: { name: "Service" } };
const rec = (id: number, ticketId: number, offsetDays: number | null) => ({
  id, employeeId: 1, ticketId, dateIssued: new Date("2020-01-01"),
  expiryDate: offsetDays === null ? null : new Date(now.getTime() + offsetDays * DAY),
  ticket: { ticketName: `T${ticketId}` },
});

beforeEach(() => {
  getEmployeeIdsInScope.mockResolvedValue([1]);
  mockPrisma.employee.findMany.mockResolvedValue([emp]);
  mockPrisma.ticketRecords.findMany.mockResolvedValue([
    rec(1, 10, 20),     // expiring (≤30)
    rec(2, 11, 60),     // expiring (≤90)
    rec(3, 12, 200),    // beyond window
    rec(4, 13, -5),     // expired
    rec(5, 14, -400), rec(6, 14, 300), // renewed — old one ignored, new one beyond window
    rec(7, 15, null),   // never expires
  ]);
  findMissingItems.mockResolvedValue([{ employeeId: 1, kind: "Ticket", itemId: 16, itemName: "T16", reason: "NotProvided" }]);
  mockPrisma.documentSubmission.findMany.mockResolvedValue([
    {
      id: 9, employeeId: 1, kind: "Ticket", ticketId: 10, trainingId: null, status: "Pending",
      createdAt: now, reviewComment: null, submittedByUserId: "u1",
      employee: emp, ticket: { ticketName: "T10" }, training: null, submittedByUser: { name: "Jo X" },
    },
  ]);
});

describe("documentStatusService.getStatus", () => {
  it("splits current records into expiring/expired, adds missing and open-submission chips", async () => {
    const s = await documentStatusService.getStatus({ userId: "u1", role: "User" }, {}, now);

    expect(s.expiring.map((r) => [r.itemId, r.days])).toEqual([[10, 20], [11, 60]]);
    expect(s.expiring[0].open).toEqual({ id: 9, status: "Pending", isMine: true });
    expect(s.expired.map((r) => r.itemId)).toEqual([13]);
    expect(s.missing.map((r) => r.itemId)).toEqual([16]);
    expect(s.submitted.map((r) => r.id)).toEqual([9]);
    expect(s.reviewQueue).toBeNull();
  });

  it("admins get the review queue", async () => {
    getEmployeeIdsInScope.mockResolvedValue("all");
    const s = await documentStatusService.getStatus({ userId: "a", role: "Admin" }, {}, now);
    expect(s.reviewQueue?.map((r) => r.id)).toEqual([9]);
  });
});

describe("documentStatusService.count", () => {
  it("employee/manager: expired + missing + expiring within 30 days", async () => {
    expect(await documentStatusService.count({ userId: "u1", role: "User" }, now)).toBe(3); // 13 + 16 + 10
  });
  it("admin: pending reviews + expiring within 30 days (long-expired items don't count)", async () => {
    getEmployeeIdsInScope.mockResolvedValue("all");
    expect(await documentStatusService.count({ userId: "a", role: "Admin" }, now)).toBe(2); // review 9 + item 10
  });
});
