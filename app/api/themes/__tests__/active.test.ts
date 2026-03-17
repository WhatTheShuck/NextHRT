// app/api/themes/__tests__/active.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockGetSession, mockPrisma, mockGetSettings } = vi.hoisted(() => {
  const mockGetSession = vi.fn();
  const mockGetSettings = vi.fn();
  const mockPrisma = {
    user: { update: vi.fn() },
  };
  return { mockGetSession, mockPrisma, mockGetSettings };
});

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: mockGetSession } },
}));
vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));
vi.mock("@/lib/services/appSettingService", () => ({
  appSettingService: { getSettings: mockGetSettings },
}));

import { PUT } from "@/app/api/themes/active/route";

const adminSession = { user: { id: "admin-1", role: "Admin" } };
const userSession  = { user: { id: "user-1",  role: "User"  } };

function makeRequest(body: object): NextRequest {
  return new NextRequest("http://localhost/api/themes/active", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSettings.mockResolvedValue({ "theme.lock": "false" });
  mockPrisma.user.update.mockResolvedValue({});
});

describe("PUT /api/themes/active", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await PUT(makeRequest({ themeId: "theme-1" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-Admin when theme.lock is true", async () => {
    mockGetSession.mockResolvedValue(userSession);
    mockGetSettings.mockResolvedValue({ "theme.lock": "true" });
    const res = await PUT(makeRequest({ themeId: "theme-1" }));
    expect(res.status).toBe(403);
  });

  it("allows an Admin to change theme even when locked", async () => {
    mockGetSession.mockResolvedValue(adminSession);
    mockGetSettings.mockResolvedValue({ "theme.lock": "true" });
    const res = await PUT(makeRequest({ themeId: "theme-1" }));
    expect(res.status).toBe(200);
  });

  it("updates user.themeId to the provided id", async () => {
    mockGetSession.mockResolvedValue(userSession);
    await PUT(makeRequest({ themeId: "theme-abc" }));
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { themeId: "theme-abc" },
    });
  });

  it("clears user.themeId when themeId is null", async () => {
    mockGetSession.mockResolvedValue(userSession);
    await PUT(makeRequest({ themeId: null }));
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { themeId: null },
    });
  });

  it("returns 200 with { success: true } on success", async () => {
    mockGetSession.mockResolvedValue(userSession);
    const res = await PUT(makeRequest({ themeId: "theme-1" }));
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(true);
  });
});
