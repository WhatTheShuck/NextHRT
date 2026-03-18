import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    ticketRecords: {
      count: vi.fn(),
    },
  };
  return { mockPrisma };
});

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import { ticketExpiryHandler } from "@/lib/jobs/handlers/ticketExpiry";

describe("ticketExpiryHandler", () => {
  beforeEach(() => {
    mockPrisma.ticketRecords.count.mockResolvedValue(0);
  });

  it("returns expired and expiringSoon counts", async () => {
    mockPrisma.ticketRecords.count
      .mockResolvedValueOnce(5)  // expired
      .mockResolvedValueOnce(3); // expiringSoon

    const result = await ticketExpiryHandler({});

    expect(result).toEqual({ expired: 5, expiringSoon: 3 });
  });

  it("returns zeros when there are no expired or expiring tickets", async () => {
    mockPrisma.ticketRecords.count.mockResolvedValue(0);

    const result = await ticketExpiryHandler({});

    expect(result).toEqual({ expired: 0, expiringSoon: 0 });
  });

  it("counts expired tickets with expiryDate at or before now", async () => {
    await ticketExpiryHandler({});

    const firstCall = mockPrisma.ticketRecords.count.mock.calls[0][0];
    expect(firstCall.where.expiryDate).toHaveProperty("lte");
    expect(firstCall.where.expiryDate.lte).toBeInstanceOf(Date);
  });

  it("counts expiring-soon tickets using a future cutoff ~30 days out", async () => {
    const before = new Date();
    await ticketExpiryHandler({});
    const after = new Date();

    const secondCall = mockPrisma.ticketRecords.count.mock.calls[1][0];
    const { gt, lte } = secondCall.where.expiryDate;

    // gt should be approximately now
    expect(gt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(gt.getTime()).toBeLessThanOrEqual(after.getTime());

    // lte should be approximately 30 days in the future
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    expect(lte.getTime() - gt.getTime()).toBeCloseTo(thirtyDaysMs, -4);
  });
});
