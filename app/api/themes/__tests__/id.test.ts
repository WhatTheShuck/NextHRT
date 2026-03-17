// app/api/themes/__tests__/id.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockGetSession, mockThemeService } = vi.hoisted(() => {
  const mockGetSession = vi.fn();
  const mockThemeService = {
    getThemeById: vi.fn(),
    updateTheme: vi.fn(),
    deleteTheme: vi.fn(),
  };
  return { mockGetSession, mockThemeService };
});

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: mockGetSession } },
}));
vi.mock("@/lib/services/themeService", () => ({
  themeService: mockThemeService,
}));
vi.mock("@/lib/themes/themeParser", () => ({
  parseThemeInput: vi.fn().mockReturnValue({ cssVars: { "--primary": "266 85% 58%" }, darkCssVars: {} }),
}));

import { PUT, DELETE } from "@/app/api/themes/[id]/route";

const adminSession     = { user: { id: "admin-1", role: "Admin" } };
const userSession      = { user: { id: "user-1",  role: "User"  } };
const otherUserSession = { user: { id: "user-2",  role: "User"  } };

function makeRequest(method: string, body?: object): NextRequest {
  return new NextRequest("http://localhost/api/themes/theme-1", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

const makeParams = (id = "theme-1") => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  mockThemeService.updateTheme.mockResolvedValue({
    id: "theme-1", name: "Updated", slug: "test",
    type: "USER", cssVars: {}, darkCssVars: {}, userId: "user-1",
  });
  mockThemeService.deleteTheme.mockResolvedValue(undefined);
});

// ─── PUT ──────────────────────────────────────────────────────────────────────

describe("PUT /api/themes/:id", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await PUT(makeRequest("PUT", { name: "X" }), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 404 when theme does not exist", async () => {
    mockGetSession.mockResolvedValue(userSession);
    mockThemeService.getThemeById.mockResolvedValue(null);
    const res = await PUT(makeRequest("PUT", { name: "X" }), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 403 for BUILTIN themes", async () => {
    mockGetSession.mockResolvedValue(adminSession);
    mockThemeService.getThemeById.mockResolvedValue({
      id: "theme-1", type: "BUILTIN", userId: null,
    });
    const res = await PUT(makeRequest("PUT", { name: "X" }), makeParams());
    expect(res.status).toBe(403);
  });

  it("returns 403 for COMPANY theme when requester is not Admin", async () => {
    mockGetSession.mockResolvedValue(userSession);
    mockThemeService.getThemeById.mockResolvedValue({
      id: "theme-1", type: "COMPANY", userId: null,
    });
    const res = await PUT(makeRequest("PUT", { name: "X" }), makeParams());
    expect(res.status).toBe(403);
  });

  it("returns 403 for USER theme when requester is not the owner", async () => {
    mockGetSession.mockResolvedValue(otherUserSession);
    mockThemeService.getThemeById.mockResolvedValue({
      id: "theme-1", type: "USER", userId: "user-1",
    });
    const res = await PUT(makeRequest("PUT", { name: "X" }), makeParams());
    expect(res.status).toBe(403);
  });

  it("returns 200 when the owner updates their USER theme", async () => {
    mockGetSession.mockResolvedValue(userSession);
    mockThemeService.getThemeById.mockResolvedValue({
      id: "theme-1", type: "USER", userId: "user-1",
    });
    const res = await PUT(makeRequest("PUT", { name: "Updated" }), makeParams());
    expect(res.status).toBe(200);
  });

  it("returns 200 when an Admin updates a COMPANY theme", async () => {
    mockGetSession.mockResolvedValue(adminSession);
    mockThemeService.getThemeById.mockResolvedValue({
      id: "theme-1", type: "COMPANY", userId: null,
    });
    const res = await PUT(makeRequest("PUT", { name: "Updated" }), makeParams());
    expect(res.status).toBe(200);
  });
});

// ─── DELETE ───────────────────────────────────────────────────────────────────

describe("DELETE /api/themes/:id", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await DELETE(makeRequest("DELETE"), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 404 when theme does not exist", async () => {
    mockGetSession.mockResolvedValue(userSession);
    mockThemeService.getThemeById.mockResolvedValue(null);
    const res = await DELETE(makeRequest("DELETE"), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 403 for BUILTIN themes", async () => {
    mockGetSession.mockResolvedValue(adminSession);
    mockThemeService.getThemeById.mockResolvedValue({
      id: "theme-1", type: "BUILTIN", userId: null,
    });
    const res = await DELETE(makeRequest("DELETE"), makeParams());
    expect(res.status).toBe(403);
  });

  it("returns 403 for COMPANY theme when requester is not Admin", async () => {
    mockGetSession.mockResolvedValue(userSession);
    mockThemeService.getThemeById.mockResolvedValue({
      id: "theme-1", type: "COMPANY", userId: null,
    });
    const res = await DELETE(makeRequest("DELETE"), makeParams());
    expect(res.status).toBe(403);
  });

  it("returns 403 for USER theme when requester is not the owner", async () => {
    mockGetSession.mockResolvedValue(otherUserSession);
    mockThemeService.getThemeById.mockResolvedValue({
      id: "theme-1", type: "USER", userId: "user-1",
    });
    const res = await DELETE(makeRequest("DELETE"), makeParams());
    expect(res.status).toBe(403);
  });

  it("returns 200 when the owner deletes their USER theme", async () => {
    mockGetSession.mockResolvedValue(userSession);
    mockThemeService.getThemeById.mockResolvedValue({
      id: "theme-1", type: "USER", userId: "user-1",
    });
    const res = await DELETE(makeRequest("DELETE"), makeParams());
    expect(res.status).toBe(200);
  });

  it("allows an Admin to delete another user's USER theme", async () => {
    mockGetSession.mockResolvedValue(adminSession);
    mockThemeService.getThemeById.mockResolvedValue({
      id: "theme-1", type: "USER", userId: "user-1",
    });
    const res = await DELETE(makeRequest("DELETE"), makeParams());
    expect(res.status).toBe(200);
  });
});
