// app/api/themes/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockGetSession, mockThemeService, mockParseThemeInput } = vi.hoisted(() => {
  const mockGetSession = vi.fn();
  const mockThemeService = {
    listThemes: vi.fn(),
    createTheme: vi.fn(),
  };
  const mockParseThemeInput = vi.fn().mockReturnValue({
    cssVars: { "--primary": "266 85% 58%" },
    darkCssVars: { "--primary": "267 84% 81%" },
  });
  return { mockGetSession, mockThemeService, mockParseThemeInput };
});

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: mockGetSession } },
}));
vi.mock("@/lib/services/themeService", () => ({
  themeService: mockThemeService,
}));
vi.mock("@/lib/themes/themeParser", () => ({
  parseThemeInput: mockParseThemeInput,
}));

import { GET, POST } from "@/app/api/themes/route";

const adminSession = { user: { id: "admin-1", role: "Admin" } };
const userSession  = { user: { id: "user-1",  role: "User"  } };

function makeRequest(method: string, body?: object): NextRequest {
  return new NextRequest("http://localhost/api/themes", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockThemeService.listThemes.mockResolvedValue([]);
  mockThemeService.createTheme.mockResolvedValue({
    id: "new-theme", name: "Test", slug: "test",
    type: "USER", cssVars: {}, darkCssVars: {}, userId: "user-1",
  });
  mockParseThemeInput.mockReturnValue({
    cssVars: { "--primary": "266 85% 58%" },
    darkCssVars: {},
  });
});

describe("GET /api/themes", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await GET(makeRequest("GET"));
    expect(res.status).toBe(401);
  });

  it("returns 200 with the theme list when authenticated", async () => {
    mockGetSession.mockResolvedValue(userSession);
    mockThemeService.listThemes.mockResolvedValue([
      { id: "t1", name: "Default", slug: "default", type: "BUILTIN" },
    ]);
    const res = await GET(makeRequest("GET"));
    expect(res.status).toBe(200);
    const body = await res.json() as unknown[];
    expect(body).toHaveLength(1);
  });
});

describe("POST /api/themes", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await POST(
      makeRequest("POST", { name: "My Theme", pasteInput: ":root{}" })
    );
    expect(res.status).toBe(401);
  });

  it("forces type to USER for non-admins even if COMPANY is requested", async () => {
    mockGetSession.mockResolvedValue(userSession);
    await POST(
      makeRequest("POST", { name: "My Theme", pasteInput: ":root{}", type: "COMPANY" })
    );
    expect(mockThemeService.createTheme).toHaveBeenCalledWith(
      expect.objectContaining({ type: "USER" })
    );
  });

  it("creates a COMPANY theme when the requester is an Admin", async () => {
    mockGetSession.mockResolvedValue(adminSession);
    await POST(
      makeRequest("POST", { name: "Corp Theme", pasteInput: ":root{}", type: "COMPANY" })
    );
    expect(mockThemeService.createTheme).toHaveBeenCalledWith(
      expect.objectContaining({ type: "COMPANY" })
    );
  });

  it("returns 201 on success", async () => {
    mockGetSession.mockResolvedValue(userSession);
    const res = await POST(
      makeRequest("POST", { name: "My Theme", pasteInput: ":root{}" })
    );
    expect(res.status).toBe(201);
  });

  it("returns 400 when name is empty", async () => {
    mockGetSession.mockResolvedValue(userSession);
    const res = await POST(
      makeRequest("POST", { name: "", pasteInput: ":root{}" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when pasteInput produces no valid vars", async () => {
    mockGetSession.mockResolvedValue(userSession);
    mockParseThemeInput.mockImplementationOnce(() => {
      throw new Error("No valid CSS variables found");
    });
    const res = await POST(
      makeRequest("POST", { name: "Bad Theme", pasteInput: ":root{}" })
    );
    expect(res.status).toBe(400);
  });

  it("prefixes the slug with user-{id}- for USER themes", async () => {
    mockGetSession.mockResolvedValue(userSession);
    await POST(
      makeRequest("POST", { name: "My Theme", pasteInput: ":root{}" })
    );
    expect(mockThemeService.createTheme).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: expect.stringContaining("user-user-1-"),
      })
    );
  });
});
