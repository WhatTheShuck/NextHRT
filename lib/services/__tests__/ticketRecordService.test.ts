import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    ticketRecords: { findFirst: vi.fn(), create: vi.fn() },
    employee: { findUnique: vi.fn() },
    ticket: { findUnique: vi.fn() },
    history: { create: vi.fn() },
  },
}));
vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

const { saveFiles } = vi.hoisted(() => ({ saveFiles: vi.fn() }));
vi.mock("@/lib/services/fileUploadService", () => ({ fileUploadService: { saveFiles } }));
vi.mock("@/lib/jobs/jobQueue", () => ({ enqueue: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { userHasPermission: vi.fn() } } }));
vi.mock("@/lib/services/authorityService", () => ({ getLineScopeForUser: vi.fn() }));
vi.mock("@/lib/apiRBAC", () => ({ getChildDepartmentIds: vi.fn() }));

import { ticketRecordService } from "@/lib/services/ticketRecordService";

const issued = "2026-01-09T14:00:00.000Z";

beforeEach(() => {
  mockPrisma.ticketRecords.findFirst.mockResolvedValue(null);
  mockPrisma.employee.findUnique.mockResolvedValue({ id: 1 });
  mockPrisma.ticket.findUnique.mockResolvedValue({ id: 2, renewal: 3 });
  mockPrisma.ticketRecords.create.mockImplementation(async ({ data }: any) => ({ id: 99, ...data }));
  saveFiles.mockResolvedValue([]);
});

describe("ticketRecordService.createTicketRecord", () => {
  it("manual expiry on or before the issue date → INVALID_EXPIRY_DATE, and no files are saved", async () => {
    await expect(
      ticketRecordService.createTicketRecord(
        { employeeId: 1, ticketId: 2, dateIssued: issued, manualExpiryOverride: true, expiryDate: issued },
        [],
        "u",
      ),
    ).rejects.toThrow("INVALID_EXPIRY_DATE");
    expect(saveFiles).not.toHaveBeenCalled();
    expect(mockPrisma.ticketRecords.create).not.toHaveBeenCalled();
  });

  it("without the override a supplied expiry is ignored: issue + renewal years is stored", async () => {
    await ticketRecordService.createTicketRecord(
      { employeeId: 1, ticketId: 2, dateIssued: issued, manualExpiryOverride: false, expiryDate: "2027-06-01T14:00:00.000Z" },
      [],
      "u",
    );
    const stored = mockPrisma.ticketRecords.create.mock.calls[0][0].data.expiryDate as Date;
    expect(stored.toISOString()).toBe("2029-01-09T14:00:00.000Z");
  });
});
