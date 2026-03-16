import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    employee: {
      updateMany: vi.fn(),
    },
  };
  return { mockPrisma };
});

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import { inactiveEmployeeCheckHandler } from "@/lib/jobs/handlers/inactiveEmployeeCheck";

describe("inactiveEmployeeCheckHandler", () => {
  beforeEach(() => {
    mockPrisma.employee.updateMany.mockResolvedValue({ count: 0 });
  });

  it("calls updateMany with isActive: true and finishDate lte now", async () => {
    const before = new Date();
    await inactiveEmployeeCheckHandler({});
    const after = new Date();

    expect(mockPrisma.employee.updateMany).toHaveBeenCalledOnce();
    const call = mockPrisma.employee.updateMany.mock.calls[0][0];

    expect(call.where.isActive).toBe(true);
    expect(call.where.finishDate.lte.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(call.where.finishDate.lte.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it("sets isActive to false on matched employees", async () => {
    await inactiveEmployeeCheckHandler({});

    const call = mockPrisma.employee.updateMany.mock.calls[0][0];
    expect(call.data).toEqual({ isActive: false });
  });

  it("returns the deactivated count from updateMany", async () => {
    mockPrisma.employee.updateMany.mockResolvedValue({ count: 4 });

    const result = await inactiveEmployeeCheckHandler({});

    expect(result).toEqual({ deactivated: 4 });
  });

  it("returns { deactivated: 0 } when no employees are past their finish date", async () => {
    mockPrisma.employee.updateMany.mockResolvedValue({ count: 0 });

    const result = await inactiveEmployeeCheckHandler({});

    expect(result).toEqual({ deactivated: 0 });
  });
});
