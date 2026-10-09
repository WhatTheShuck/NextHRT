import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, mockEnqueue } = vi.hoisted(() => {
  const mockPrisma = {
    employee: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    documentSubmission: { updateMany: vi.fn() },
  };
  const mockEnqueue = vi.fn();
  return { mockPrisma, mockEnqueue };
});

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));
vi.mock("@/lib/jobs/jobQueue", () => ({ enqueue: mockEnqueue }));
const { cancelOpenForEmployees, OPEN_STATUSES } = vi.hoisted(() => ({
  cancelOpenForEmployees: vi.fn(),
  OPEN_STATUSES: ["Pending", "ChangesRequested"],
}));
vi.mock("@/lib/services/documentSubmissionService", () => ({
  documentSubmissionService: { cancelOpenForEmployees },
  OPEN_STATUSES,
}));

import { inactiveEmployeeCheckHandler } from "@/lib/jobs/handlers/inactiveEmployeeCheck";

describe("inactiveEmployeeCheckHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.employee.findMany.mockResolvedValue([]);
    mockPrisma.employee.updateMany.mockResolvedValue({ count: 0 });
    mockEnqueue.mockResolvedValue(undefined);
    mockPrisma.documentSubmission.updateMany.mockResolvedValue({ count: 0 });
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
    expect(result).toEqual({ deactivated: 2, assetCheckinsEnqueued: 2, staleSubmissionsCancelled: 0 });
  });

  it("returns { deactivated: 0 } and touches no employees when no employees are past their finish date", async () => {
    const result = await inactiveEmployeeCheckHandler({});

    expect(result).toEqual({ deactivated: 0, staleSubmissionsCancelled: 0 });
    expect(mockPrisma.employee.updateMany).not.toHaveBeenCalled();
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it("cancels open document submissions for everyone it deactivates", async () => {
    mockPrisma.employee.findMany.mockResolvedValue([{ id: 3 }, { id: 4 }]);
    mockPrisma.employee.updateMany.mockResolvedValue({ count: 2 });

    await inactiveEmployeeCheckHandler({});

    expect(cancelOpenForEmployees).toHaveBeenCalledWith([3, 4]);
  });

  it("still enqueues ASSET_CHECKIN when cancelling submissions fails", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    mockPrisma.employee.findMany.mockResolvedValue([{ id: 3 }]);
    mockPrisma.employee.updateMany.mockResolvedValue({ count: 1 });
    cancelOpenForEmployees.mockRejectedValueOnce(new Error("db locked"));

    const result = await inactiveEmployeeCheckHandler({});

    expect(mockEnqueue).toHaveBeenCalledWith("ASSET_CHECKIN", { employeeId: 3 });
    expect(result).toEqual({ deactivated: 1, assetCheckinsEnqueued: 1, staleSubmissionsCancelled: 0 });
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it("sweeps open submissions left on already-inactive employees, even when nobody is deactivated", async () => {
    mockPrisma.documentSubmission.updateMany.mockResolvedValue({ count: 2 });

    const result = await inactiveEmployeeCheckHandler({});

    expect(mockPrisma.documentSubmission.updateMany).toHaveBeenCalledWith({
      where: { employee: { isActive: false }, status: { in: ["Pending", "ChangesRequested"] } },
      data: { status: "Cancelled" },
    });
    // The service's definition of "open", not a copy of it.
    expect(mockPrisma.documentSubmission.updateMany.mock.calls[0][0].where.status.in).toBe(OPEN_STATUSES);
    expect(result).toEqual({ deactivated: 0, staleSubmissionsCancelled: 2 });
  });

  it("sweeps after deactivating, so a failed per-employee cancel is caught the same night", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    mockPrisma.employee.findMany.mockResolvedValue([{ id: 3 }]);
    mockPrisma.employee.updateMany.mockResolvedValue({ count: 1 });
    cancelOpenForEmployees.mockRejectedValueOnce(new Error("db locked"));
    mockPrisma.documentSubmission.updateMany.mockResolvedValue({ count: 1 });

    const result = await inactiveEmployeeCheckHandler({});

    expect(mockPrisma.employee.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      mockPrisma.documentSubmission.updateMany.mock.invocationCallOrder[0],
    );
    expect(result).toEqual({ deactivated: 1, assetCheckinsEnqueued: 1, staleSubmissionsCancelled: 1 });
    err.mockRestore();
  });

  it("the sweep is best-effort: a failure is logged and reported as null", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    mockPrisma.employee.findMany.mockResolvedValue([{ id: 3 }]);
    mockPrisma.employee.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.documentSubmission.updateMany.mockRejectedValueOnce(new Error("db locked"));

    const result = await inactiveEmployeeCheckHandler({});

    expect(mockEnqueue).toHaveBeenCalledWith("ASSET_CHECKIN", { employeeId: 3 });
    expect(result).toEqual({ deactivated: 1, assetCheckinsEnqueued: 1, staleSubmissionsCancelled: null });
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});
