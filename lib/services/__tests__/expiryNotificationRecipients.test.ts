import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    employee: { findUnique: vi.fn() },
    user: { findMany: vi.fn() },
  };
  return { mockPrisma };
});

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import { resolveExpiryRecipients } from "@/lib/services/expiryNotificationRecipients";

beforeEach(() => vi.clearAllMocks());

describe("resolveExpiryRecipients", () => {
  it("returns dept managers as To and opted-in admins as Cc, excluding opt-outs", async () => {
    mockPrisma.employee.findUnique.mockResolvedValue({ id: 1, departmentId: 5 });
    mockPrisma.user.findMany
      .mockResolvedValueOnce([{ email: "mgr@x.com" }]) // managers of dept 5
      .mockResolvedValueOnce([{ email: "admin1@x.com" }]); // opted-in admins (query filters opt-outs)

    const r = await resolveExpiryRecipients(1);

    expect(r.to).toContain("mgr@x.com");
    expect(r.cc).toContain("admin1@x.com");
  });

  it("excludes an admin who has opted out (query filter)", async () => {
    mockPrisma.employee.findUnique.mockResolvedValue({ id: 1, departmentId: 5 });
    mockPrisma.user.findMany
      .mockResolvedValueOnce([{ email: "mgr@x.com" }])
      .mockResolvedValueOnce([{ email: "admin1@x.com" }]);

    await resolveExpiryRecipients(1);

    // admins query must filter on receivesExpiryNotifications: true
    const adminQuery = mockPrisma.user.findMany.mock.calls[1][0];
    expect(adminQuery.where.receivesExpiryNotifications).toBe(true);
    expect(adminQuery.where.role).toBe("Admin");
  });

  it("promotes admins to To when there are no managers", async () => {
    mockPrisma.employee.findUnique.mockResolvedValue({ id: 1, departmentId: 5 });
    mockPrisma.user.findMany
      .mockResolvedValueOnce([]) // no managers
      .mockResolvedValueOnce([{ email: "admin1@x.com" }]);

    const r = await resolveExpiryRecipients(1);

    expect(r.to).toContain("admin1@x.com");
    expect(r.cc).toEqual([]);
  });

  it("returns empty recipients when the employee is not found", async () => {
    mockPrisma.employee.findUnique.mockResolvedValue(null);

    const r = await resolveExpiryRecipients(999);

    expect(r).toEqual({ to: [], cc: [] });
  });

  it("does not duplicate an email that is both manager and admin", async () => {
    mockPrisma.employee.findUnique.mockResolvedValue({ id: 1, departmentId: 5 });
    mockPrisma.user.findMany
      .mockResolvedValueOnce([{ email: "both@x.com" }])
      .mockResolvedValueOnce([{ email: "both@x.com" }, { email: "admin1@x.com" }]);

    const r = await resolveExpiryRecipients(1);

    expect(r.to).toEqual(["both@x.com"]);
    expect(r.cc).toEqual(["admin1@x.com"]);
  });
});
