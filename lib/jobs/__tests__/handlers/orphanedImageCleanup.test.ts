import { describe, it, expect, vi, beforeEach, type MockedFunction } from "vitest";
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
    trainingRevision: {
      findMany: vi.fn(),
    },
    appSetting: {
      findMany: vi.fn(),
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

// vi.mocked resolves readdirSync to its buffer overload; retype the mock to
// the string/withFileTypes overload the handler actually calls.
const mockedReaddirSync = vi.mocked(fs.readdirSync) as unknown as MockedFunction<
  (path: fs.PathLike, options?: { withFileTypes?: boolean }) => fs.Dirent[]
>;

beforeEach(() => {
  mockPrisma.trainingImage.findMany.mockResolvedValue([]);
  mockPrisma.ticketImage.findMany.mockResolvedValue([]);
  mockPrisma.trainingImage.deleteMany.mockResolvedValue({ count: 0 });
  mockPrisma.ticketImage.deleteMany.mockResolvedValue({ count: 0 });
  mockPrisma.trainingRevision.findMany.mockResolvedValue([]);
  mockPrisma.appSetting.findMany.mockResolvedValue([]);

  // Default: uploads dir does not exist (keeps tests isolated)
  vi.mocked(fs.existsSync).mockReturnValue(false);
  vi.mocked(fs.readdirSync).mockReturnValue([]);
  vi.mocked(fs.unlinkSync).mockImplementation(() => undefined);
});

describe("orphanedImageCleanupHandler — DB records without files on disk", () => {
  it("deletes training image DB records whose file is missing on disk", async () => {
    // Real stored format: no "uploads/" prefix — fileUploadService returns
    // "<subDir>/<uuid>.<ext>" and the record services store it verbatim.
    mockPrisma.trainingImage.findMany.mockResolvedValue([
      { id: 1, imagePath: "training/missing.jpg" },
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
    const imagePath = "training/present.jpg";
    mockPrisma.trainingImage.findMany.mockResolvedValue([{ id: 2, imagePath }]);
    // Only the correctly-resolved location under uploads/ exists on disk
    const fullPath = path.join(process.cwd(), "uploads", imagePath);
    vi.mocked(fs.existsSync).mockImplementation((p) => p.toString() === fullPath);

    await orphanedImageCleanupHandler({});

    expect(mockPrisma.trainingImage.deleteMany).not.toHaveBeenCalled();
  });

  it("deletes ticket image DB records whose file is missing on disk", async () => {
    mockPrisma.ticketImage.findMany.mockResolvedValue([
      { id: 10, imagePath: "tickets/gone.png" },
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
      { id: 1, imagePath: "training/a.jpg" },
      { id: 2, imagePath: "training/b.jpg" },
    ]);
    mockPrisma.ticketImage.findMany.mockResolvedValue([
      { id: 10, imagePath: "tickets/c.png" },
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
    const trainingDir = path.join(uploadsDir, "training");
    const orphanFullPath = path.join(trainingDir, "orphan.jpg");

    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const str = p.toString();
      return str === uploadsDir || str === trainingDir;
    });
    mockedReaddirSync.mockImplementation((dir) =>
      dir.toString() === trainingDir ? [makeFileDirent("orphan.jpg")] : [],
    );

    const result = await orphanedImageCleanupHandler({});

    expect(fs.unlinkSync).toHaveBeenCalledWith(orphanFullPath);
    expect(result.orphanedFiles).toBe(1);
  });

  it("never scans uploads/ itself or folders it does not manage", async () => {
    const uploadsDir = path.join(process.cwd(), "uploads");

    vi.mocked(fs.existsSync).mockReturnValue(true);
    mockedReaddirSync.mockImplementation((dir) => {
      if (dir.toString() === uploadsDir) {
        return [makeFileDirent("stray.pdf")];
      }
      if (dir.toString() === path.join(uploadsDir, "something-new")) {
        return [makeFileDirent("keep.pdf")];
      }
      return [];
    });

    const result = await orphanedImageCleanupHandler({});

    expect(fs.unlinkSync).not.toHaveBeenCalled();
    expect(result.orphanedFiles).toBe(0);
  });

  it("does NOT delete compliance attachments referenced by onboarding settings", async () => {
    mockPrisma.appSetting.findMany.mockResolvedValue([
      {
        value: JSON.stringify([
          { path: "compliance/forms-a.pdf", name: "Forms A.pdf", size: 10 },
          { path: "compliance/forms-b.pdf", name: "Forms B.pdf", size: 10 },
        ]),
      },
      // Legacy single-path format for the police check slot
      { value: "compliance/police.pdf" },
    ]);

    const uploadsDir = path.join(process.cwd(), "uploads");
    const complianceDir = path.join(uploadsDir, "compliance");

    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const str = p.toString();
      return str === uploadsDir || str === complianceDir;
    });
    mockedReaddirSync.mockImplementation((dir) =>
      dir.toString() === complianceDir
        ? [
            makeFileDirent("forms-a.pdf"),
            makeFileDirent("forms-b.pdf"),
            makeFileDirent("police.pdf"),
            makeFileDirent("removed-long-ago.pdf"),
          ]
        : [],
    );

    const result = await orphanedImageCleanupHandler({});

    expect(fs.unlinkSync).toHaveBeenCalledTimes(1);
    expect(fs.unlinkSync).toHaveBeenCalledWith(
      path.join(complianceDir, "removed-long-ago.pdf"),
    );
    expect(result.orphanedFiles).toBe(1);
  });

  it("does NOT delete disk files that ARE referenced in the DB", async () => {
    const imagePath = "training/keep.jpg";
    mockPrisma.trainingImage.findMany.mockResolvedValue([{ id: 5, imagePath }]);

    const uploadsDir = path.join(process.cwd(), "uploads");
    const trainingDir = path.join(uploadsDir, "training");
    const keepFullPath = path.join(process.cwd(), "uploads", imagePath);

    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const str = p.toString();
      return str === uploadsDir || str === trainingDir || str === keepFullPath;
    });
    mockedReaddirSync.mockImplementation((dir) => {
      if (dir.toString() === uploadsDir) {
        return [
          { name: "training", isDirectory: () => true, isFile: () => false },
        ] as unknown as fs.Dirent[];
      }
      if (dir.toString() === trainingDir) {
        return [makeFileDirent("keep.jpg")];
      }
      return [];
    });

    await orphanedImageCleanupHandler({});

    expect(fs.unlinkSync).not.toHaveBeenCalled();
  });

  it("protects legacy rows that stored an uploads/ prefix by resolving them to the same path", async () => {
    const legacyImagePath = "uploads/training/legacy.jpg";
    mockPrisma.trainingImage.findMany.mockResolvedValue([
      { id: 6, imagePath: legacyImagePath },
    ]);

    const uploadsDir = path.join(process.cwd(), "uploads");
    const trainingDir = path.join(uploadsDir, "training");
    // Legacy prefix or not, the file lives at uploads/training/legacy.jpg
    const legacyFullPath = path.join(uploadsDir, "training", "legacy.jpg");

    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const str = p.toString();
      return str === uploadsDir || str === trainingDir || str === legacyFullPath;
    });
    vi.mocked(fs.readdirSync).mockImplementation(((dir: fs.PathLike) => {
      if (dir.toString() === uploadsDir) {
        return [
          { name: "training", isDirectory: () => true, isFile: () => false },
        ] as unknown as fs.Dirent[];
      }
      if (dir.toString() === trainingDir) {
        return [makeFileDirent("legacy.jpg")] as unknown as fs.Dirent[];
      }
      return [];
    }) as any);

    await orphanedImageCleanupHandler({});

    expect(mockPrisma.trainingImage.deleteMany).not.toHaveBeenCalled();
    expect(fs.unlinkSync).not.toHaveBeenCalled();
  });

  it("does NOT delete SOP document files that are referenced by a TrainingRevision, but does delete orphaned ones", async () => {
    mockPrisma.trainingRevision.findMany.mockResolvedValue([
      { documentPath: "sop-documents/keep.pdf" },
    ]);

    const uploadsDir = path.join(process.cwd(), "uploads");
    const sopDir = path.join(uploadsDir, "sop-documents");
    const keepFullPath = path.resolve(process.cwd(), "uploads", "sop-documents/keep.pdf");
    const orphanFullPath = path.join(sopDir, "orphan.pdf");

    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const str = p.toString();
      return str === uploadsDir || str === sopDir || str === keepFullPath;
    });
    vi.mocked(fs.readdirSync).mockImplementation(((dir: fs.PathLike) => {
      if (dir.toString() === uploadsDir) {
        return [
          { name: "sop-documents", isDirectory: () => true, isFile: () => false },
        ] as unknown as fs.Dirent[];
      }
      if (dir.toString() === sopDir) {
        return [
          makeFileDirent("keep.pdf"),
          makeFileDirent("orphan.pdf"),
        ] as unknown as fs.Dirent[];
      }
      return [];
    }) as any);

    await orphanedImageCleanupHandler({});

    expect(fs.unlinkSync).not.toHaveBeenCalledWith(keepFullPath);
    expect(fs.unlinkSync).toHaveBeenCalledWith(orphanFullPath);
  });
});

describe("orphanedImageCleanupHandler — return value", () => {
  it("returns { orphanedDbRecords: 0, orphanedFiles: 0 } when everything is clean", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = await orphanedImageCleanupHandler({});

    expect(result).toEqual({ orphanedDbRecords: 0, orphanedFiles: 0 });
  });
});
