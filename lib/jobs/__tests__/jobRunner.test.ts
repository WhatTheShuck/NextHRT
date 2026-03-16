import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    backgroundJob: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  };
  return { mockPrisma };
});

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));
vi.mock("@/lib/services/appSettingService", () => ({
  appSettingService: {
    getSettings: vi.fn().mockResolvedValue({ "jobs.pollIntervalMs": "100" }),
  },
}));

import { registerHandler, startRunner, stopRunner } from "@/lib/jobs/jobRunner";

beforeEach(() => {
  mockPrisma.backgroundJob.findFirst.mockResolvedValue(null);
  mockPrisma.backgroundJob.update.mockResolvedValue({});
});

afterEach(() => {
  stopRunner();
  vi.clearAllMocks();
});

describe("tick — no pending jobs", () => {
  it("does not call update when there are no pending jobs", async () => {
    mockPrisma.backgroundJob.findFirst.mockResolvedValue(null);

    await startRunner();
    await new Promise((r) => setTimeout(r, 150));
    stopRunner();

    expect(mockPrisma.backgroundJob.update).not.toHaveBeenCalled();
  });
});

describe("tick — job processing", () => {
  it("marks a job Running then Completed when the handler succeeds", async () => {
    const jobId = 7;
    mockPrisma.backgroundJob.findFirst.mockResolvedValueOnce({
      id: jobId,
      type: "INACTIVE_EMPLOYEE_CHECK",
      payload: null,
    });

    const handler = vi.fn().mockResolvedValue({ deactivated: 2 });
    registerHandler("INACTIVE_EMPLOYEE_CHECK", handler);

    await startRunner();
    await new Promise((r) => setTimeout(r, 150));
    stopRunner();

    expect(mockPrisma.backgroundJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: jobId },
        data: expect.objectContaining({ status: "Running" }),
      }),
    );
    expect(mockPrisma.backgroundJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: jobId },
        data: expect.objectContaining({
          status: "Completed",
          resultSummary: JSON.stringify({ deactivated: 2 }),
        }),
      }),
    );
  });

  it("marks a job Failed when the handler throws", async () => {
    const jobId = 8;
    mockPrisma.backgroundJob.findFirst.mockResolvedValueOnce({
      id: jobId,
      type: "ORPHANED_IMAGE_CLEANUP",
      payload: null,
    });

    const handler = vi.fn().mockRejectedValue(new Error("disk full"));
    registerHandler("ORPHANED_IMAGE_CLEANUP", handler);

    await startRunner();
    await new Promise((r) => setTimeout(r, 150));
    stopRunner();

    expect(mockPrisma.backgroundJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: jobId },
        data: expect.objectContaining({
          status: "Failed",
          errorMessage: "disk full",
        }),
      }),
    );
  });

  it("marks a job Failed when no handler is registered for its type", async () => {
    const jobId = 9;
    mockPrisma.backgroundJob.findFirst.mockResolvedValueOnce({
      id: jobId,
      type: "HISTORY_ARCHIVAL",
      payload: null,
    });

    // Deliberately do not register a handler for HISTORY_ARCHIVAL

    await startRunner();
    await new Promise((r) => setTimeout(r, 150));
    stopRunner();

    expect(mockPrisma.backgroundJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: jobId },
        data: expect.objectContaining({
          status: "Failed",
          errorMessage: expect.stringContaining("No handler registered"),
        }),
      }),
    );
  });

  it("deserialises the payload JSON and passes it to the handler", async () => {
    const handler = vi.fn().mockResolvedValue({});
    registerHandler("REQUIREMENTS_CACHE_INVALIDATE", handler);

    mockPrisma.backgroundJob.findFirst.mockResolvedValueOnce({
      id: 10,
      type: "REQUIREMENTS_CACHE_INVALIDATE",
      payload: JSON.stringify({ employeeId: 99 }),
    });

    await startRunner();
    await new Promise((r) => setTimeout(r, 150));
    stopRunner();

    expect(handler).toHaveBeenCalledWith({ employeeId: 99 });
  });
});

describe("stopRunner", () => {
  it("stops the polling interval so no further ticks run", async () => {
    await startRunner();
    stopRunner();

    mockPrisma.backgroundJob.findFirst.mockResolvedValue({
      id: 1,
      type: "TICKET_EXPIRY",
      payload: null,
    });

    await new Promise((r) => setTimeout(r, 200));

    expect(mockPrisma.backgroundJob.update).not.toHaveBeenCalled();
  });
});
