import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, mockService, mockLog } = vi.hoisted(() => {
  const mockPrisma = {
    employee: {
      findUnique: vi.fn(),
    },
  };
  const mockService = {
    lookupUserByEmail: vi.fn(),
    offboardUser: vi.fn(),
  };
  const mockLog = vi.fn();
  return { mockPrisma, mockService, mockLog };
});

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));
vi.mock("@/lib/services/assetCheckoutService", () => ({
  assetCheckoutService: mockService,
  buildEmployeeEmail: (first: string, last: string) =>
    `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
}));
vi.mock("@/lib/services/logService", () => ({
  logService: { log: mockLog },
}));

import { assetCheckinHandler } from "@/lib/jobs/handlers/assetCheckin";

const employee = {
  id: 42,
  legalFirstName: "Jane",
  legalLastName: "Citizen",
  preferredFirstName: null,
  preferredLastName: null,
};

describe("assetCheckinHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.employee.findUnique.mockResolvedValue(employee);
    mockLog.mockResolvedValue(undefined);
  });

  it("throws when the employee does not exist", async () => {
    mockPrisma.employee.findUnique.mockResolvedValue(null);

    await expect(assetCheckinHandler({ employeeId: 42 })).rejects.toThrow(
      "Employee 42 not found",
    );
  });

  it("skips (without failing) when the employee has no Snipe user", async () => {
    mockService.lookupUserByEmail.mockResolvedValue(null);

    const result = await assetCheckinHandler({ employeeId: 42 });

    expect(mockService.lookupUserByEmail).toHaveBeenCalledWith(
      "jane.citizen@example.com",
    );
    expect(result.skipped).toBe(true);
    expect(mockService.offboardUser).not.toHaveBeenCalled();
  });

  it("prefers preferred names when building the lookup email", async () => {
    mockPrisma.employee.findUnique.mockResolvedValue({
      ...employee,
      preferredFirstName: "JC",
      preferredLastName: "Smith",
    });
    mockService.lookupUserByEmail.mockResolvedValue(null);

    await assetCheckinHandler({ employeeId: 42 });

    expect(mockService.lookupUserByEmail).toHaveBeenCalledWith(
      "jc.smith@example.com",
    );
  });

  it("offboards the Snipe user and returns the checkin summary", async () => {
    mockService.lookupUserByEmail.mockResolvedValue({ id: 7, name: "Jane Citizen" });
    mockService.offboardUser.mockResolvedValue({
      userId: 7,
      checkedIn: [{ id: 1, asset_tag: "A-100" }],
      failed: [],
      userDeactivated: true,
    });

    const result = await assetCheckinHandler({ employeeId: 42 });

    expect(mockService.offboardUser).toHaveBeenCalledWith(
      7,
      expect.stringContaining("employee 42"),
    );
    expect(result).toEqual({
      employeeId: 42,
      snipeUserId: 7,
      checkedIn: ["A-100"],
      failed: [],
      userDeactivated: true,
    });
  });

  it("fails the job when the offboard reports partial failures", async () => {
    mockService.lookupUserByEmail.mockResolvedValue({ id: 7, name: "Jane Citizen" });
    mockService.offboardUser.mockResolvedValue({
      userId: 7,
      checkedIn: [],
      failed: [{ assetId: 1, assetTag: "A-100", error: "boom" }],
      userDeactivated: true,
    });

    await expect(assetCheckinHandler({ employeeId: 42 })).rejects.toThrow(
      "manual follow-up",
    );
  });
});
