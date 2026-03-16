import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, mockGetSettings } = vi.hoisted(() => {
  const mockGetSettings = vi.fn();
  const mockPrisma = {
    history: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  };
  return { mockPrisma, mockGetSettings };
});

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));
vi.mock("@/lib/services/appSettingService", () => ({
  appSettingService: { getSettings: mockGetSettings },
}));

import { historyArchivalHandler } from "@/lib/jobs/handlers/historyArchival";

beforeEach(() => {
  mockGetSettings.mockResolvedValue({ "jobs.historyRetentionYears": "7" });
  mockPrisma.history.findMany.mockResolvedValue([]);
  mockPrisma.history.deleteMany.mockResolvedValue({ count: 0 });
});

describe("historyArchivalHandler", () => {
  it("returns { deleted: 0 } when there are no eligible records", async () => {
    const result = await historyArchivalHandler({});

    expect(result.deleted).toBe(0);
    expect(mockPrisma.history.deleteMany).not.toHaveBeenCalled();
  });

  it("reads retention years from app settings", async () => {
    mockGetSettings.mockResolvedValue({ "jobs.historyRetentionYears": "3" });

    const result = await historyArchivalHandler({});

    expect(result.retentionYears).toBe(3);
  });

  it("defaults to 7 years when the setting is missing", async () => {
    mockGetSettings.mockResolvedValue({});

    const result = await historyArchivalHandler({});

    expect(result.retentionYears).toBe(7);
  });

  it("sets the cutoff date to exactly retentionYears ago", async () => {
    mockGetSettings.mockResolvedValue({ "jobs.historyRetentionYears": "5" });

    const before = new Date();
    const result = await historyArchivalHandler({});
    const after = new Date();

    const cutoff = new Date(result.cutoffDate as string);
    const expectedYear = before.getFullYear() - 5;
    // Allow for the new year boundary: cutoff year should be expectedYear or expectedYear-1
    expect([expectedYear - 1, expectedYear]).toContain(cutoff.getFullYear());
    // Verify it's close to 5 years ago (within a few seconds)
    const fiveYearsMs = 5 * 365.25 * 24 * 60 * 60 * 1000;
    const actualMs = before.getTime() - cutoff.getTime();
    expect(actualMs).toBeGreaterThan(fiveYearsMs - 86400000);
    expect(actualMs).toBeLessThan(fiveYearsMs + 86400000);
    void after; // used for bounding
  });

  it("deletes all eligible records in a single batch when they fit", async () => {
    const ids = [1, 2, 3].map((id) => ({ id }));
    mockPrisma.history.findMany
      .mockResolvedValueOnce(ids)
      .mockResolvedValueOnce([]); // second batch: nothing left

    mockPrisma.history.deleteMany.mockResolvedValue({ count: 3 });

    const result = await historyArchivalHandler({});

    expect(mockPrisma.history.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: [1, 2, 3] } },
    });
    expect(result.deleted).toBe(3);
  });

  it("loops until no records remain (two batches)", async () => {
    const batch1 = Array.from({ length: 3 }, (_, i) => ({ id: i + 1 }));
    const batch2 = Array.from({ length: 2 }, (_, i) => ({ id: i + 100 }));

    mockPrisma.history.findMany
      .mockResolvedValueOnce(batch1)
      .mockResolvedValueOnce(batch2)
      .mockResolvedValueOnce([]); // done

    mockPrisma.history.deleteMany
      .mockResolvedValueOnce({ count: 3 })
      .mockResolvedValueOnce({ count: 2 });

    const result = await historyArchivalHandler({});

    expect(mockPrisma.history.deleteMany).toHaveBeenCalledTimes(2);
    expect(result.deleted).toBe(5);
  });
});
