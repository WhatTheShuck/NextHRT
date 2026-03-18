import { describe, it, expect, vi, beforeEach } from "vitest";
import path from "path";

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    trainingImage: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    ticketImage: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  };
  return { mockPrisma };
});

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));
vi.mock("fs");

import { orphanedImageCleanupHandler } from "@/lib/jobs/handlers/orphanedImageCleanup";
import fs from "fs";

// Build a fake Dirent object for readdirSync mocks
function makeFileDirent(name: string): fs.Dirent {
  return { name, isDirectory: () => false, isFile: () => true } as unknown as fs.Dirent;
}

beforeEach(() => {
  mockPrisma.trainingImage.findMany.mockResolvedValue([]);
  mockPrisma.ticketImage.findMany.mockResolvedValue([]);
  mockPrisma.trainingImage.deleteMany.mockResolvedValue({ count: 0 });
  mockPrisma.ticketImage.deleteMany.mockResolvedValue({ count: 0 });

  // Default: uploads dir does not exist (keeps tests isolated)
  vi.mocked(fs.existsSync).mockReturnValue(false);
  vi.mocked(fs.readdirSync).mockReturnValue([]);
  vi.mocked(fs.unlinkSync).mockImplementation(() => undefined);
});

describe("orphanedImageCleanupHandler — DB records without files on disk", () => {
  it("deletes training image DB records whose file is missing on disk", async () => {
    mockPrisma.trainingImage.findMany.mockResolvedValue([
      { id: 1, imagePath: "uploads/training/missing.jpg" },
    ]);
    // The file does not exist on disk; uploads dir also treated as absent
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = await orphanedImageCleanupHandler({});

    expect(mockPrisma.trainingImage.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: [1] } },
    });
    expect(result.orphanedDbRecords).toBe(1);
  });

  it("does NOT delete training image records whose file exists on disk", async () => {
    mockPrisma.trainingImage.findMany.mockResolvedValue([
      { id: 2, imagePath: "uploads/training/present.jpg" },
    ]);
    vi.mocked(fs.existsSync).mockReturnValue(true);

    await orphanedImageCleanupHandler({});

    expect(mockPrisma.trainingImage.deleteMany).not.toHaveBeenCalled();
  });

  it("deletes ticket image DB records whose file is missing on disk", async () => {
    mockPrisma.ticketImage.findMany.mockResolvedValue([
      { id: 10, imagePath: "uploads/tickets/gone.png" },
    ]);
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = await orphanedImageCleanupHandler({});

    expect(mockPrisma.ticketImage.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: [10] } },
    });
    expect(result.orphanedDbRecords).toBe(1);
  });

  it("accumulates orphanedDbRecords across both image types", async () => {
    mockPrisma.trainingImage.findMany.mockResolvedValue([
      { id: 1, imagePath: "uploads/training/a.jpg" },
      { id: 2, imagePath: "uploads/training/b.jpg" },
    ]);
    mockPrisma.ticketImage.findMany.mockResolvedValue([
      { id: 10, imagePath: "uploads/tickets/c.png" },
    ]);
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = await orphanedImageCleanupHandler({});

    expect(result.orphanedDbRecords).toBe(3);
  });
});

describe("orphanedImageCleanupHandler — files on disk without DB records", () => {
  it("does not scan for orphaned files when the uploads directory does not exist", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = await orphanedImageCleanupHandler({});

    expect(fs.readdirSync).not.toHaveBeenCalled();
    expect(result.orphanedFiles).toBe(0);
  });

  it("deletes disk files that are not referenced in the DB", async () => {
    const uploadsDir = path.join(process.cwd(), "uploads");
    const orphanFile = "orphan.jpg";
    const orphanFullPath = path.join(uploadsDir, orphanFile);

    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const str = p.toString();
      // uploads dir exists; individual image files are absent from DB so we
      // only need existsSync to return true for the uploads dir check
      return str === uploadsDir;
    });
    vi.mocked(fs.readdirSync).mockReturnValue(
      [makeFileDirent(orphanFile)] as unknown as fs.Dirent[],
    );

    const result = await orphanedImageCleanupHandler({});

    expect(fs.unlinkSync).toHaveBeenCalledWith(orphanFullPath);
    expect(result.orphanedFiles).toBe(1);
  });

  it("does NOT delete disk files that ARE referenced in the DB", async () => {
    const imagePath = "uploads/training/keep.jpg";
    mockPrisma.trainingImage.findMany.mockResolvedValue([{ id: 5, imagePath }]);

    const uploadsDir = path.join(process.cwd(), "uploads");
    const trainingDir = path.join(uploadsDir, "training");
    const keepFullPath = path.resolve(process.cwd(), imagePath);

    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const str = p.toString();
      return str === uploadsDir || str === keepFullPath;
    });
    vi.mocked(fs.readdirSync).mockImplementation((dir) => {
      if (dir.toString() === uploadsDir) {
        return [
          { name: "training", isDirectory: () => true, isFile: () => false },
        ] as unknown as fs.Dirent[];
      }
      if (dir.toString() === trainingDir) {
        return [makeFileDirent("keep.jpg")] as unknown as fs.Dirent[];
      }
      return [];
    });

    await orphanedImageCleanupHandler({});

    expect(fs.unlinkSync).not.toHaveBeenCalled();
  });
});

describe("orphanedImageCleanupHandler — return value", () => {
  it("returns { orphanedDbRecords: 0, orphanedFiles: 0 } when everything is clean", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = await orphanedImageCleanupHandler({});

    expect(result).toEqual({ orphanedDbRecords: 0, orphanedFiles: 0 });
  });
});
