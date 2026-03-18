import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    backgroundJob: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  };
  return { mockPrisma };
});

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import { enqueue } from "@/lib/jobs/jobQueue";

beforeEach(() => {
  mockPrisma.backgroundJob.findFirst.mockResolvedValue(null);
  mockPrisma.backgroundJob.create.mockResolvedValue({});
});

describe("enqueue", () => {
  it("creates a job when no duplicate pending job exists", async () => {
    await enqueue("TICKET_EXPIRY");

    expect(mockPrisma.backgroundJob.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "TICKET_EXPIRY",
        payload: null,
      }),
    });
  });

  it("skips creation when an identical pending job already exists", async () => {
    mockPrisma.backgroundJob.findFirst.mockResolvedValue({ id: 1 });

    await enqueue("TICKET_EXPIRY");

    expect(mockPrisma.backgroundJob.create).not.toHaveBeenCalled();
  });

  it("serialises the payload as a JSON string", async () => {
    await enqueue("REQUIREMENTS_CACHE_INVALIDATE", { employeeId: 42 });

    expect(mockPrisma.backgroundJob.findFirst).toHaveBeenCalledWith({
      where: {
        type: "REQUIREMENTS_CACHE_INVALIDATE",
        status: "Pending",
        payload: JSON.stringify({ employeeId: 42 }),
      },
    });
    expect(mockPrisma.backgroundJob.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        payload: JSON.stringify({ employeeId: 42 }),
      }),
    });
  });

  it("uses the provided scheduledAt date", async () => {
    const future = new Date("2030-01-01T00:00:00Z");
    await enqueue("HISTORY_ARCHIVAL", undefined, future);

    expect(mockPrisma.backgroundJob.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ scheduledAt: future }),
    });
  });

  it("defaults scheduledAt to now when not provided", async () => {
    const before = new Date();
    await enqueue("EXEMPTION_EXPIRY");
    const after = new Date();

    const { scheduledAt } = mockPrisma.backgroundJob.create.mock.calls[0][0].data;
    expect(scheduledAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(scheduledAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});
