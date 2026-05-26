import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAuth } from "@/lib/api-auth";
import { themeService } from "@/lib/services/themeService";
import { parseThemeInput } from "@/lib/themes/themeParser";

export async function GET(request: NextRequest) {
  const session = await getAuth(request);
  if (!session) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });

  const themes = await themeService.listThemes();
  return NextResponse.json(themes);
}

export async function POST(request: NextRequest) {
  const session = await getAuth(request);
  if (!session) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });

  try {
    const body = await request.json() as {
      name: string;
      pasteInput?: string;
      cssVars?: Record<string, string>;
      darkCssVars?: Record<string, string>;
      type?: string;
    };

    const isAdmin = session.user.role === "Admin";
    const type: "COMPANY" | "USER" = (isAdmin && body.type === "COMPANY") ? "COMPANY" : "USER";

    let cssVars: Record<string, string> = body.cssVars ?? {};
    let darkCssVars: Record<string, string> = body.darkCssVars ?? {};

    if (body.pasteInput) {
      const parsed = parseThemeInput(body.pasteInput);
      cssVars = parsed.cssVars;
      darkCssVars = parsed.darkCssVars;
    }

    if (!body.name?.trim()) {
      return NextResponse.json({ message: "Theme name is required" }, { status: 400 });
    }

    const baseSlug = body.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const slug = type === "USER" ? `user-${session.user.id}-${baseSlug}` : baseSlug;

    const theme = await themeService.createTheme({
      name: body.name.trim(),
      slug,
      type,
      cssVars,
      darkCssVars,
      userId: type === "USER" ? session.user.id : undefined,
    });

    return NextResponse.json(theme, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to create theme" },
      { status: 400 }
    );
  }
}
