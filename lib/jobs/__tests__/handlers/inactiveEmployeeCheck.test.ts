import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, mockEnqueue } = vi.hoisted(() => {
  const mockPrisma = {
    employee: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  };
  const mockEnqueue = vi.fn();
  return { mockPrisma, mockEnqueue };
});

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));
vi.mock("@/lib/jobs/jobQueue", () => ({ enqueue: mockEnqueue }));

import { inactiveEmployeeCheckHandler } from "@/lib/jobs/handlers/inactiveEmployeeCheck";

describe("inactiveEmployeeCheckHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.employee.findMany.mockResolvedValue([]);
    mockPrisma.employee.updateMany.mockResolvedValue({ count: 0 });
    mockEnqueue.mockResolvedValue(undefined);
  });

  it("queries for active employees whose finishDate is lte now", async () => {
    const before = new Date();
    await inactiveEmployeeCheckHandler({});
    const after = new Date();

    expect(mockPrisma.employee.findMany).toHaveBeenCalledOnce();
    const call = mockPrisma.employee.findMany.mock.calls[0][0];

    expect(call.where.isActive).toBe(true);
    expect(call.where.finishDate.lte.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(call.where.finishDate.lte.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it("sets isActive to false on the matched employees", async () => {
    mockPrisma.employee.findMany.mockResolvedValue([{ id: 7 }, { id: 9 }]);
    mockPrisma.employee.updateMany.mockResolvedValue({ count: 2 });

    await inactiveEmployeeCheckHandler({});

    const call = mockPrisma.employee.updateMany.mock.calls[0][0];
    expect(call.where).toEqual({ id: { in: [7, 9] } });
    expect(call.data).toEqual({ isActive: false });
  });

  it("enqueues one ASSET_CHECKIN job per deactivated employee", async () => {
    mockPrisma.employee.findMany.mockResolvedValue([{ id: 7 }, { id: 9 }]);
    mockPrisma.employee.updateMany.mockResolvedValue({ count: 2 });

    const result = await inactiveEmployeeCheckHandler({});

    expect(mockEnqueue).toHaveBeenCalledTimes(2);
    expect(mockEnqueue).toHaveBeenCalledWith("ASSET_CHECKIN", { employeeId: 7 });
    expect(mockEnqueue).toHaveBeenCalledWith("ASSET_CHECKIN", { employeeId: 9 });
    expect(result).toEqual({ deactivated: 2, assetCheckinsEnqueued: 2 });
  });

  it("returns { deactivated: 0 } and touches nothing when no employees are past their finish date", async () => {
    const result = await inactiveEmployeeCheckHandler({});

    expect(result).toEqual({ deactivated: 0 });
    expect(mockPrisma.employee.updateMany).not.toHaveBeenCalled();
    expect(mockEnqueue).not.toHaveBeenCalled();
  });
});
