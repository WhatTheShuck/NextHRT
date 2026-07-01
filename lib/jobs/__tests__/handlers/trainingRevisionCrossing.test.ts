import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, mockEnqueue } = vi.hoisted(() => {
  const mockPrisma = {
    trainingRevision: { findMany: vi.fn() },
    requirementsCacheEntry: { findMany: vi.fn() },
  };
  const mockEnqueue = vi.fn();
  return { mockPrisma, mockEnqueue };
});

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));
vi.mock("@/lib/jobs/jobQueue", () => ({ enqueue: mockEnqueue }));

import { trainingRevisionCrossingHandler } from "@/lib/jobs/handlers/trainingRevisionCrossing";

const now = new Date();
const pastDate = new Date(now.getTime() - 1 * 60 * 60 * 1000); // 1 hour ago — in window
const futureDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // tomorrow — not yet effective
const oldDate = new Date(now.getTime() - 48 * 60 * 60 * 1000); // 48h ago — outside window but still effective

const makeRevision = (id: number, effectiveDate: Date, override: boolean | null = null) => ({
  id,
  effectiveDate,
  createdAt: new Date("2020-01-01"),
  overrideRequiresRetraining: override,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.requirementsCacheEntry.findMany.mockResolvedValue([]);
});

describe("trainingRevisionCrossingHandler", () => {
  it("returns 0 affected employees when no revisions are in the window", async () => {
    mockPrisma.trainingRevision.findMany.mockResolvedValue([]);

    const result = await trainingRevisionCrossingHandler({});

    expect(result).toEqual({ revisionsChecked: 0, affectedEmployees: 0 });
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it("does not enqueue when the recent revision is superseded by a newer one", async () => {
    // oldDate revision (in window) but futureDate revision is newer — so cur !== recently-effective revision
    // Wait: oldDate is outside the 25h window; we need the old revision to still be the current but
    // superseded. Let me use: rev 1 effectiveDate = pastDate (in window), rev 2 effectiveDate = now (also
    // in window, but more recent, so rev 2 is current not rev 1).
    const newerDate = new Date(now.getTime() - 30 * 60 * 1000); // 30 min ago

    const training = {
      id: 10,
      requiresRetrainingOnRevision: true,
      revisions: [makeRevision(1, pastDate), makeRevision(2, newerDate)],
    };
    // Handler will be called with rev 1 (in window). But current revision = rev 2. So rev 1 is skipped.
    mockPrisma.trainingRevision.findMany.mockResolvedValue([
      { ...makeRevision(1, pastDate), training },
    ]);

    const result = await trainingRevisionCrossingHandler({});

    expect(mockEnqueue).not.toHaveBeenCalled();
    expect(result).toMatchObject({ revisionsChecked: 1, affectedEmployees: 0 });
  });

  it("does not enqueue when the revision requires no retraining (type-level false)", async () => {
    const training = {
      id: 10,
      requiresRetrainingOnRevision: false,
      revisions: [makeRevision(1, pastDate)],
    };
    mockPrisma.trainingRevision.findMany.mockResolvedValue([
      { ...makeRevision(1, pastDate), training },
    ]);

    await trainingRevisionCrossingHandler({});

    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it("does not enqueue when the revision's override disables retraining", async () => {
    const training = {
      id: 10,
      requiresRetrainingOnRevision: true,
      revisions: [makeRevision(1, pastDate, false)], // override = false
    };
    mockPrisma.trainingRevision.findMany.mockResolvedValue([
      { ...makeRevision(1, pastDate, false), training },
    ]);

    await trainingRevisionCrossingHandler({});

    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it("enqueues REQUIREMENTS_CACHE_INVALIDATE for each affected employee", async () => {
    const training = {
      id: 10,
      requiresRetrainingOnRevision: true,
      revisions: [makeRevision(1, pastDate)],
    };
    mockPrisma.trainingRevision.findMany.mockResolvedValue([
      { ...makeRevision(1, pastDate), training },
    ]);
    mockPrisma.requirementsCacheEntry.findMany.mockResolvedValue([
      { employeeId: 101 },
      { employeeId: 202 },
    ]);

    const result = await trainingRevisionCrossingHandler({});

    expect(mockEnqueue).toHaveBeenCalledWith("REQUIREMENTS_CACHE_INVALIDATE", { employeeId: 101 });
    expect(mockEnqueue).toHaveBeenCalledWith("REQUIREMENTS_CACHE_INVALIDATE", { employeeId: 202 });
    expect(result).toEqual({ revisionsChecked: 1, affectedEmployees: 2 });
  });

  it("enqueues via override=true even when type-level flag is false", async () => {
    const training = {
      id: 10,
      requiresRetrainingOnRevision: false,
      revisions: [makeRevision(1, pastDate, true)], // override forces retraining
    };
    mockPrisma.trainingRevision.findMany.mockResolvedValue([
      { ...makeRevision(1, pastDate, true), training },
    ]);
    mockPrisma.requirementsCacheEntry.findMany.mockResolvedValue([
      { employeeId: 55 },
    ]);

    await trainingRevisionCrossingHandler({});

    expect(mockEnqueue).toHaveBeenCalledWith("REQUIREMENTS_CACHE_INVALIDATE", { employeeId: 55 });
  });
});
