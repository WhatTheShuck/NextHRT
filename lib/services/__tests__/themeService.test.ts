// lib/services/__tests__/themeService.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    theme: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      upsert: vi.fn(),
    },
  };
  return { mockPrisma };
});

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(true),
    readdirSync: vi.fn().mockReturnValue(["default.json"]),
    readFileSync: vi.fn().mockReturnValue(
      JSON.stringify({ name: "Default", cssVars: {}, darkCssVars: {} })
    ),
  };
});

import {
  renderThemeCss,
  themeService,
  type ThemeWithCss,
} from "@/lib/services/themeService";

const makeTheme = (overrides: Partial<ThemeWithCss> = {}): ThemeWithCss => ({
  id: "theme-1",
  name: "Test Theme",
  slug: "test-theme",
  type: "BUILTIN",
  userId: null,
  cssVars: { "--primary": "266 85% 58%" },
  darkCssVars: { "--primary": "267 84% 81%" },
  ...overrides,
});

const makeDbTheme = (overrides: object = {}) => ({
  id: "theme-1",
  name: "Test Theme",
  slug: "test-theme",
  type: "BUILTIN",
  userId: null,
  cssVars: { "--primary": "266 85% 58%" },
  darkCssVars: { "--primary": "267 84% 81%" },
  createdAt: new Date(),
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.theme.findUnique.mockResolvedValue(null);
  mockPrisma.theme.findMany.mockResolvedValue([]);
  mockPrisma.theme.create.mockResolvedValue(makeDbTheme());
  mockPrisma.theme.update.mockResolvedValue(makeDbTheme());
  mockPrisma.theme.delete.mockResolvedValue(makeDbTheme());
  mockPrisma.theme.upsert.mockResolvedValue(makeDbTheme());
});

// ─── renderThemeCss ───────────────────────────────────────────────────────────

describe("renderThemeCss", () => {
  it("generates a :root block for light vars", () => {
    const css = renderThemeCss({ "--primary": "266 85% 58%" }, {});
    expect(css).toContain(":root {");
    expect(css).toContain("  --primary: 266 85% 58%;");
  });

  it("generates a .dark block for dark vars", () => {
    const css = renderThemeCss({}, { "--primary": "267 84% 81%" });
    expect(css).toContain(".dark {");
    expect(css).toContain("  --primary: 267 84% 81%;");
  });

  it("filters out vars not in the KNOWN_VARS allowlist", () => {
    const css = renderThemeCss(
      { "--primary": "266 85% 58%", "--sidebar": "0 0% 100%" },
      {}
    );
    expect(css).not.toContain("--sidebar");
  });

  it("returns an empty string when both var objects are empty", () => {
    expect(renderThemeCss({}, {})).toBe("");
  });
});

// ─── getCss caching ───────────────────────────────────────────────────────────

describe("ThemeService.getCss", () => {
  it("returns a CSS string containing the theme vars", () => {
    const css = themeService.getCss(makeTheme());
    expect(css).toContain("--primary");
  });

  it("returns the same string on a second call (cache hit)", () => {
    const theme = makeTheme({ id: "cache-same-id" });
    const first = themeService.getCss(theme);
    // Mutate the object — the cache key is the id, so result should be unchanged
    theme.cssVars = { "--primary": "0 0% 0%" };
    const second = themeService.getCss(theme);
    expect(second).toBe(first);
  });

  it("re-renders after deleteTheme clears the cache entry", async () => {
    const id = "cache-invalidation-id";
    const theme1 = makeTheme({ id, cssVars: { "--primary": "266 85% 58%" } });
    const css1 = themeService.getCss(theme1);

    // deleteTheme calls invalidateCache(id) internally
    await themeService.deleteTheme(id);

    const theme2 = makeTheme({ id, cssVars: { "--primary": "0 0% 0%" } });
    const css2 = themeService.getCss(theme2);

    expect(css2).not.toBe(css1);
    expect(css2).toContain("--primary: 0 0% 0%");
  });
});

// ─── resolveActiveTheme ───────────────────────────────────────────────────────

describe("ThemeService.resolveActiveTheme", () => {
  it("returns the org default when lockTheme=true, ignoring userThemeId", async () => {
    const orgDefault = makeDbTheme({ id: "org-id", slug: "org-default" });
    mockPrisma.theme.findUnique.mockResolvedValue(orgDefault);

    const result = await themeService.resolveActiveTheme({
      userThemeId: "user-theme-id",
      defaultThemeSlug: "org-default",
      lockTheme: true,
    });

    expect(result.id).toBe("org-id");
  });

  it("returns built-in default object when lockTheme=true and nothing resolves", async () => {
    mockPrisma.theme.findUnique.mockResolvedValue(null);

    const result = await themeService.resolveActiveTheme({ lockTheme: true });

    expect(result.id).toBe("default");
    expect(result.cssVars).toEqual({});
  });

  it("returns the user theme when not locked and userThemeId is set", async () => {
    const userTheme = makeDbTheme({
      id: "user-theme-id",
      type: "USER",
      userId: "user-1",
    });
    mockPrisma.theme.findUnique.mockResolvedValue(userTheme);

    const result = await themeService.resolveActiveTheme({
      userThemeId: "user-theme-id",
      defaultThemeSlug: "org-default",
      lockTheme: false,
    });

    expect(result.id).toBe("user-theme-id");
  });

  it("falls back to org default when the user theme no longer exists", async () => {
    const orgDefault = makeDbTheme({ id: "org-id", slug: "org-default" });
    mockPrisma.theme.findUnique
      .mockResolvedValueOnce(null)         // user theme deleted
      .mockResolvedValueOnce(orgDefault);  // org default found

    const result = await themeService.resolveActiveTheme({
      userThemeId: "deleted-theme-id",
      defaultThemeSlug: "org-default",
      lockTheme: false,
    });

    expect(result.id).toBe("org-id");
  });

  it("falls back to the built-in default object when nothing resolves", async () => {
    mockPrisma.theme.findUnique.mockResolvedValue(null);

    const result = await themeService.resolveActiveTheme({ lockTheme: false });

    expect(result.id).toBe("default");
    expect(result.cssVars).toEqual({});
  });
});

// ─── CRUD ────────────────────────────────────────────────────────────────────

describe("ThemeService.createTheme", () => {
  it("calls prisma.theme.create with the correct data", async () => {
    await themeService.createTheme({
      name: "My Theme",
      slug: "my-theme",
      type: "USER",
      cssVars: { "--primary": "266 85% 58%" },
      darkCssVars: {},
      userId: "user-1",
    });

    expect(mockPrisma.theme.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "My Theme",
        slug: "my-theme",
        type: "USER",
        userId: "user-1",
      }),
    });
  });
});

describe("ThemeService.updateTheme", () => {
  it("calls prisma.theme.update with the correct id and data", async () => {
    await themeService.updateTheme("theme-abc", { name: "Updated" });

    expect(mockPrisma.theme.update).toHaveBeenCalledWith({
      where: { id: "theme-abc" },
      data: expect.objectContaining({ name: "Updated" }),
    });
  });
});

describe("ThemeService.deleteTheme", () => {
  it("calls prisma.theme.delete with the correct id", async () => {
    await themeService.deleteTheme("theme-abc");

    expect(mockPrisma.theme.delete).toHaveBeenCalledWith({
      where: { id: "theme-abc" },
    });
  });
});

describe("ThemeService.ensureBuiltins", () => {
  it("upserts each JSON builtin file to the database", async () => {
    await themeService.ensureBuiltins();

    expect(mockPrisma.theme.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { slug: "default" },
        create: expect.objectContaining({ name: "Default", type: "BUILTIN" }),
      })
    );
  });
});
