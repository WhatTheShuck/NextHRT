import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    appLog: {
      create: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  };
  return { mockPrisma };
});

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import { logService } from "@/lib/services/logService";

beforeEach(() => vi.clearAllMocks());

describe("logService.log", () => {
  it("creates an AppLog with Info severity by default", async () => {
    mockPrisma.appLog.create.mockResolvedValue({});
    await logService.log("Test message");
    expect(mockPrisma.appLog.create).toHaveBeenCalledWith({
      data: { message: "Test message", severity: "Info", source: undefined },
    });
  });

  it("creates an AppLog with specified severity and source", async () => {
    mockPrisma.appLog.create.mockResolvedValue({});
    await logService.log("Orphan found", "Warning", "approvalService");
    expect(mockPrisma.appLog.create).toHaveBeenCalledWith({
      data: { message: "Orphan found", severity: "Warning", source: "approvalService" },
    });
  });
});

describe("logService.getLogs", () => {
  it("fetches logs ordered by createdAt descending", async () => {
    mockPrisma.appLog.findMany.mockResolvedValue([]);
    await logService.getLogs();
    expect(mockPrisma.appLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: "desc" } }),
    );
  });

  it("filters by severity when provided", async () => {
    mockPrisma.appLog.findMany.mockResolvedValue([]);
    await logService.getLogs({ severity: "Warning" });
    expect(mockPrisma.appLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { severity: "Warning" } }),
    );
  });

  it("applies limit when provided", async () => {
    mockPrisma.appLog.findMany.mockResolvedValue([]);
    await logService.getLogs({ limit: 10 });
    expect(mockPrisma.appLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 }),
    );
  });
});

describe("logService.clearLogs", () => {
  it("deletes logs older than the specified number of days and returns count", async () => {
    mockPrisma.appLog.deleteMany.mockResolvedValue({ count: 3 });
    const count = await logService.clearLogs(30);
    expect(count).toBe(3);
    expect(mockPrisma.appLog.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { createdAt: { lt: expect.any(Date) } },
      }),
    );
  });
});
