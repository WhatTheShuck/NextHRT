import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import prisma from "@/lib/prisma";
import type { Theme, ThemeType } from "@/generated/prisma_client/client";
import { parseThemeInput, type ParsedTheme } from "@/lib/themes/themeParser";

const KNOWN_VARS = [
  "--primary", "--primary-foreground",
  "--secondary", "--secondary-foreground",
  "--accent", "--accent-foreground",
  "--muted", "--muted-foreground",
  "--background", "--foreground",
  "--card", "--card-foreground",
  "--popover", "--popover-foreground",
  "--destructive", "--destructive-foreground",
  "--border", "--input", "--ring", "--radius",
  "--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5",
];

function buildCssBlock(vars: Record<string, string>, selector: string): string {
  const entries = Object.entries(vars).filter(([k]) => KNOWN_VARS.includes(k));
  if (entries.length === 0) return "";
  const body = entries.map(([k, v]) => `  ${k}: ${v};`).join("\n");
  return `${selector} {\n${body}\n}`;
}

export function renderThemeCss(
  cssVars: Record<string, string>,
  darkCssVars: Record<string, string>
): string {
  const light = buildCssBlock(cssVars, ":root");
  const dark = buildCssBlock(darkCssVars, ".dark");
  return [light, dark].filter(Boolean).join("\n");
}

// Server-side in-memory cache: themeId → rendered CSS string
const cssCache = new Map<string, string>();

function invalidateCache(themeId?: string) {
  if (themeId) {
    cssCache.delete(themeId);
  } else {
    cssCache.clear();
  }
}

export interface ThemeWithCss {
  id: string;
  name: string;
  slug: string;
  type: ThemeType;
  userId: string | null;
  cssVars: Record<string, string>;
  darkCssVars: Record<string, string>;
}

function toThemeWithCss(theme: Theme): ThemeWithCss {
  return {
    id: theme.id,
    name: theme.name,
    slug: theme.slug,
    type: theme.type,
    userId: theme.userId ?? null,
    cssVars: (theme.cssVars as Record<string, string>) ?? {},
    darkCssVars: (theme.darkCssVars as Record<string, string>) ?? {},
  };
}

export class ThemeService {
  async ensureBuiltins(): Promise<void> {
    const builtinsDir = join(process.cwd(), "lib", "themes", "builtins");
    if (!existsSync(builtinsDir)) return;

    const files = readdirSync(builtinsDir).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      const slug = file.replace(".json", "");
      const raw = JSON.parse(readFileSync(join(builtinsDir, file), "utf-8")) as {
        name: string;
        cssVars: Record<string, string>;
        darkCssVars?: Record<string, string>;
      };

      await prisma.theme.upsert({
        where: { slug },
        create: {
          slug,
          name: raw.name,
          type: "BUILTIN",
          cssVars: raw.cssVars,
          darkCssVars: raw.darkCssVars ?? {},
        },
        update: {
          name: raw.name,
          cssVars: raw.cssVars,
          darkCssVars: raw.darkCssVars ?? {},
        },
      });
    }
    invalidateCache();
  }

  async loadDockerTheme(): Promise<void> {
    const themeFile = process.env.THEME_FILE;
    if (!themeFile || !existsSync(themeFile)) return;

    try {
      const content = readFileSync(themeFile, "utf-8");
      const parsed: ParsedTheme = parseThemeInput(content);
      const trimmed = content.trim();
      const name = trimmed.startsWith("{")
        ? ((JSON.parse(trimmed) as { name?: string }).name ?? "Docker Theme")
        : "Docker Theme";
      const slug = "docker-theme";

      await prisma.theme.upsert({
        where: { slug },
        create: { slug, name, type: "COMPANY", cssVars: parsed.cssVars, darkCssVars: parsed.darkCssVars },
        update: { name, cssVars: parsed.cssVars, darkCssVars: parsed.darkCssVars },
      });
      invalidateCache();
    } catch (err) {
      console.error("[themeService] Failed to load THEME_FILE:", err);
    }
  }

  async listThemes(type?: ThemeType): Promise<ThemeWithCss[]> {
    const themes = await prisma.theme.findMany({
      where: type ? { type } : undefined,
      orderBy: [{ type: "asc" }, { name: "asc" }],
    });
    return themes.map(toThemeWithCss);
  }

  async getThemeBySlug(slug: string): Promise<ThemeWithCss | null> {
    const theme = await prisma.theme.findUnique({ where: { slug } });
    return theme ? toThemeWithCss(theme) : null;
  }

  async getThemeById(id: string): Promise<ThemeWithCss | null> {
    const theme = await prisma.theme.findUnique({ where: { id } });
    return theme ? toThemeWithCss(theme) : null;
  }

  async createTheme(data: {
    name: string;
    slug: string;
    type: ThemeType;
    cssVars: Record<string, string>;
    darkCssVars: Record<string, string>;
    userId?: string;
  }): Promise<ThemeWithCss> {
    const theme = await prisma.theme.create({ data });
    invalidateCache();
    return toThemeWithCss(theme);
  }

  async updateTheme(
    id: string,
    data: {
      name?: string;
      cssVars?: Record<string, string>;
      darkCssVars?: Record<string, string>;
    }
  ): Promise<ThemeWithCss> {
    const theme = await prisma.theme.update({ where: { id }, data });
    invalidateCache(id);
    return toThemeWithCss(theme);
  }

  async deleteTheme(id: string): Promise<void> {
    await prisma.theme.delete({ where: { id } });
    invalidateCache(id);
  }

  async resolveActiveTheme(opts: {
    userId?: string;
    userThemeId?: string | null;
    defaultThemeSlug?: string;
    lockTheme?: boolean;
  }): Promise<ThemeWithCss> {
    const { userThemeId, defaultThemeSlug, lockTheme } = opts;

    const builtinDefault: ThemeWithCss = {
      id: "default",
      name: "Default",
      slug: "default",
      type: "BUILTIN",
      userId: null,
      cssVars: {},
      darkCssVars: {},
    };

    // Lock always suppresses user override — regardless of whether a slug is set
    if (lockTheme) {
      if (defaultThemeSlug) {
        const t = await this.getThemeBySlug(defaultThemeSlug);
        if (t) return t;
      }
      return (await this.getThemeBySlug("default")) ?? builtinDefault;
    }

    // User preference takes precedence over org default
    if (userThemeId) {
      const t = await this.getThemeById(userThemeId);
      if (t) return t;
      // User's saved theme was deleted — fall through to org default
    }

    if (defaultThemeSlug) {
      const t = await this.getThemeBySlug(defaultThemeSlug);
      if (t) return t;
    }

    return (await this.getThemeBySlug("default")) ?? builtinDefault;
  }

  /** Returns rendered CSS string for a theme, using in-memory cache. */
  getCss(theme: ThemeWithCss): string {
    if (cssCache.has(theme.id)) return cssCache.get(theme.id)!;
    const css = renderThemeCss(theme.cssVars, theme.darkCssVars);
    cssCache.set(theme.id, css);
    return css;
  }
}

export const themeService = new ThemeService();
