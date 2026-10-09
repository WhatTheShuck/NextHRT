import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: { employee: { findUnique: vi.fn() }, user: { findMany: vi.fn() } },
}));
vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

const { mockAuthority } = vi.hoisted(() => ({
  mockAuthority: { getAuthorityMode: vi.fn(), getExpiryRecipientEmployeeIds: vi.fn() },
}));
vi.mock("@/lib/services/authorityService", () => mockAuthority);

import { resolveExpiryRecipients } from "@/lib/services/expiryNotificationRecipients";

beforeEach(() => {
  mockAuthority.getAuthorityMode.mockResolvedValue("department");
});

describe("resolveExpiryRecipients", () => {
  it("returns the department's managers, deduped, and never queries admins", async () => {
    mockPrisma.employee.findUnique.mockResolvedValue({ id: 1, departmentId: 5 });
    mockPrisma.user.findMany.mockResolvedValue([{ email: "mgr@x.com" }, { email: "mgr@x.com" }]);

    expect(await resolveExpiryRecipients(1)).toEqual({ to: ["mgr@x.com"] });
    expect(mockPrisma.user.findMany).toHaveBeenCalledTimes(1);
  });

  it("no managers → nobody (admins use the Expiring & Missing page instead)", async () => {
    mockPrisma.employee.findUnique.mockResolvedValue({ id: 1, departmentId: 5 });
    mockPrisma.user.findMany.mockResolvedValue([]);
    expect(await resolveExpiryRecipients(1)).toEqual({ to: [] });
  });

  it("unknown employee → nobody", async () => {
    mockPrisma.employee.findUnique.mockResolvedValue(null);
    expect(await resolveExpiryRecipients(999)).toEqual({ to: [] });
  });

  it("line-manager authority: direct manager and their delegates", async () => {
    mockAuthority.getAuthorityMode.mockResolvedValue("lineManager");
    mockAuthority.getExpiryRecipientEmployeeIds.mockResolvedValue([8, 10]);
    mockPrisma.employee.findUnique.mockResolvedValue({ id: 9, departmentId: 33 });
    mockPrisma.user.findMany.mockResolvedValue([{ email: "joshua@x.com" }, { email: "carolyn@x.com" }]);

    const r = await resolveExpiryRecipients(9);

    expect(mockPrisma.user.findMany.mock.calls[0][0].where).toEqual({ employeeId: { in: [8, 10] }, email: { not: null } });
    expect(r).toEqual({ to: ["joshua@x.com", "carolyn@x.com"] });
  });
});
