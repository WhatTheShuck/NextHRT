import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    employee: { findMany: vi.fn(), update: vi.fn() },
  },
}));

const { mockAC } = vi.hoisted(() => ({
  mockAC: { listUserPhones: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));
vi.mock("@/lib/services/assetCheckoutService", () => ({
  assetCheckoutService: mockAC,
  buildEmployeeEmail: (f: string, l: string) =>
    `${f.toLowerCase()}.${l.toLowerCase()}@ksb.com`,
}));
vi.mock("@/lib/services/logService", () => ({
  logService: { log: vi.fn() },
}));

import { snipePhoneSyncHandler } from "@/lib/jobs/handlers/snipePhoneSync";

function emp(
  id: number,
  legalFirstName: string,
  legalLastName: string,
  phone: string | null,
  mobile: string | null,
) {
  return {
    id,
    legalFirstName,
    legalLastName,
    preferredFirstName: null,
    preferredLastName: null,
    phone,
    mobile,
  };
}

beforeEach(() => vi.clearAllMocks());

describe("snipePhoneSyncHandler", () => {
  it("updates only employees whose landline or mobile differs, skips unmatched", async () => {
    mockAC.listUserPhones.mockResolvedValue([
      { email: "jane.doe@ksb.com", phone: "111", mobile: "0400111" },
      { email: "bob.smith@ksb.com", phone: "222", mobile: "0400222" },
      { email: "carol.lee@ksb.com", phone: "333", mobile: "0400999" },
    ]);
    mockPrisma.employee.findMany.mockResolvedValue([
      emp(1, "Jane", "Doe", null, null), // changed: gains landline + mobile
      emp(2, "Bob", "Smith", "222", "0400222"), // unchanged
      emp(3, "Alice", "Wong", null, null), // no Snipe user → skip
      emp(4, "Carol", "Lee", "333", "0400333"), // mobile differs → update
    ]);

    const result = await snipePhoneSyncHandler({});

    expect(mockPrisma.employee.update).toHaveBeenCalledTimes(2);
    expect(mockPrisma.employee.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { phone: "111", mobile: "0400111" },
    });
    expect(mockPrisma.employee.update).toHaveBeenCalledWith({
      where: { id: 4 },
      data: { phone: "333", mobile: "0400999" },
    });
    expect(result).toEqual({ snipeUsers: 3, employeesUpdated: 2 });
  });
});
