import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, hasAccessToEmployee } = vi.hoisted(() => ({
  mockPrisma: { documentSubmissionFile: { findFirst: vi.fn() } },
  hasAccessToEmployee: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));
vi.mock("@/lib/apiRBAC", () => ({ hasAccessToEmployee }));
vi.mock("fs", () => ({ existsSync: () => true }));
vi.mock("fs/promises", () => ({ readFile: vi.fn().mockResolvedValue(Buffer.from("x")) }));

import { imageService } from "@/lib/services/imageService";

beforeEach(() => {
  mockPrisma.documentSubmissionFile.findFirst.mockResolvedValue({
    submission: { employeeId: 7, submittedByUserId: "sub" },
  });
});

describe("imageService submissions/ branch", () => {
  it("serves the submitter without a scope check", async () => {
    const r = await imageService.getImage("submissions/a.jpg", "sub", "User" as any);
    expect(r.contentType).toBe("image/jpeg");
    expect(hasAccessToEmployee).not.toHaveBeenCalled();
  });

  it("serves an in-scope viewer (manager/admin)", async () => {
    hasAccessToEmployee.mockResolvedValue(true);
    await expect(imageService.getImage("submissions/a.pdf", "mgr", "DepartmentManager" as any)).resolves.toMatchObject({
      contentType: "application/pdf",
    });
    expect(hasAccessToEmployee).toHaveBeenCalledWith("mgr", 7, "DepartmentManager");
  });

  it("refuses an out-of-scope viewer and an unknown file", async () => {
    hasAccessToEmployee.mockResolvedValue(false);
    await expect(imageService.getImage("submissions/a.jpg", "x", "User" as any)).rejects.toThrow("NOT_AUTHORISED");
    mockPrisma.documentSubmissionFile.findFirst.mockResolvedValue(null);
    await expect(imageService.getImage("submissions/b.jpg", "x", "User" as any)).rejects.toThrow("IMAGE_NOT_FOUND");
  });
});
