import { describe, it, expect, vi } from "vitest";

const { unlink, existsSync } = vi.hoisted(() => ({ unlink: vi.fn(), existsSync: vi.fn(() => true) }));
vi.mock("fs/promises", () => ({ unlink, writeFile: vi.fn(), mkdir: vi.fn() }));
vi.mock("fs", () => ({ existsSync }));

import { fileUploadService } from "@/lib/services/fileUploadService";

describe("fileUploadService.deleteFile", () => {
  it("unlinks ordinary uploads", async () => {
    await fileUploadService.deleteFile("tickets/a.jpg");
    expect(unlink).toHaveBeenCalledTimes(1);
  });

  it("never unlinks submission files — the cleanup job owns them", async () => {
    await fileUploadService.deleteFiles(["submissions/a.jpg", "submissions/b.pdf"]);
    expect(unlink).not.toHaveBeenCalled();
  });
});
