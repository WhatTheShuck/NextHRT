import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, mockEnqueue } = vi.hoisted(() => {
  const mockPrisma = {
    trainingTicketExemption: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  };
  const mockEnqueue = vi.fn();
  return { mockPrisma, mockEnqueue };
});

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));
vi.mock("@/lib/jobs/jobQueue", () => ({ enqueue: mockEnqueue }));

import { exemptionExpiryHandler } from "@/lib/jobs/handlers/exemptionExpiry";

beforeEach(() => {
  mockPrisma.trainingTicketExemption.updateMany.mockResolvedValue({ count: 0 });
  mockEnqueue.mockResolvedValue(undefined);
});

describe("exemptionExpiryHandler", () => {
  it("returns { expired: 0 } and skips updateMany when no exemptions have expired", async () => {
    mockPrisma.trainingTicketExemption.findMany.mockResolvedValue([]);

    const result = await exemptionExpiryHandler({});

    expect(result).toEqual({ expired: 0 });
    expect(mockPrisma.trainingTicketExemption.updateMany).not.toHaveBeenCalled();
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it("updates matching exemptions to Expired status", async () => {
    mockPrisma.trainingTicketExemption.findMany.mockResolvedValue([
      { id: 1, employeeId: 10 },
      { id: 2, employeeId: 20 },
    ]);

    await exemptionExpiryHandler({});

    expect(mockPrisma.trainingTicketExemption.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [1, 2] } },
      data: { status: "Expired" },
    });
  });

  it("enqueues a cache invalidation for each unique employee affected", async () => {
    mockPrisma.trainingTicketExemption.findMany.mockResolvedValue([
      { id: 1, employeeId: 10 },
      { id: 2, employeeId: 20 },
    ]);

    await exemptionExpiryHandler({});

    expect(mockEnqueue).toHaveBeenCalledTimes(2);
    expect(mockEnqueue).toHaveBeenCalledWith("REQUIREMENTS_CACHE_INVALIDATE", { employeeId: 10 });
    expect(mockEnqueue).toHaveBeenCalledWith("REQUIREMENTS_CACHE_INVALIDATE", { employeeId: 20 });
  });

  it("deduplicates employees — two exemptions for the same employee produce one enqueue", async () => {
    mockPrisma.trainingTicketExemption.findMany.mockResolvedValue([
      { id: 1, employeeId: 10 },
      { id: 2, employeeId: 10 },
    ]);

    await exemptionExpiryHandler({});

    expect(mockEnqueue).toHaveBeenCalledTimes(1);
    expect(mockEnqueue).toHaveBeenCalledWith("REQUIREMENTS_CACHE_INVALIDATE", { employeeId: 10 });
  });

  it("returns the correct expired count and employeesAffected", async () => {
    mockPrisma.trainingTicketExemption.findMany.mockResolvedValue([
      { id: 1, employeeId: 10 },
      { id: 2, employeeId: 10 },
      { id: 3, employeeId: 20 },
    ]);

    const result = await exemptionExpiryHandler({});

    expect(result).toEqual({ expired: 3, employeesAffected: 2 });
  });

  it("queries only Active exemptions with endDate at or before now", async () => {
    mockPrisma.trainingTicketExemption.findMany.mockResolvedValue([]);

    await exemptionExpiryHandler({});

    const [call] = mockPrisma.trainingTicketExemption.findMany.mock.calls;
    expect(call[0].where.status).toBe("Active");
    expect(call[0].where.endDate).toHaveProperty("lte");
  });
});
