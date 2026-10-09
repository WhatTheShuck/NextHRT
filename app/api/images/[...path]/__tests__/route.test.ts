import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockGetAuth, mockGetImage } = vi.hoisted(() => ({
  mockGetAuth: vi.fn(),
  mockGetImage: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/lib/api-auth", () => ({ getAuth: mockGetAuth }));
vi.mock("@/lib/services/imageService", () => ({ imageService: { getImage: mockGetImage } }));

import { GET } from "@/app/api/images/[...path]/route";

describe("GET /api/images/[...path]", () => {
  it("tells the browser not to sniff the served file's type", async () => {
    mockGetAuth.mockResolvedValue({ user: { id: "u1", role: "User" } });
    mockGetImage.mockResolvedValue({ buffer: Buffer.from("%PDF-1.7"), contentType: "application/pdf" });

    const res = await GET(new NextRequest("http://localhost/api/images/submissions/a.pdf"), {
      params: Promise.resolve({ path: ["submissions", "a.pdf"] }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
});
