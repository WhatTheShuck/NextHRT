import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAuth } from "@/lib/api-auth";
import { themeService } from "@/lib/services/themeService";
import { parseThemeInput } from "@/lib/themes/themeParser";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuth(request);
  if (!session) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const existing = await themeService.getThemeById(id);
  if (!existing) return NextResponse.json({ message: "Theme not found" }, { status: 404 });

  const isAdmin = session.user.role === "Admin";
  if (existing.type === "BUILTIN") {
    return NextResponse.json({ message: "Built-in themes cannot be modified" }, { status: 403 });
  }
  if (existing.type === "COMPANY" && !isAdmin) {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }
  if (existing.type === "USER" && existing.userId !== session.user.id && !isAdmin) {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  try {
    const body = await request.json() as {
      name?: string;
      pasteInput?: string;
      cssVars?: Record<string, string>;
      darkCssVars?: Record<string, string>;
    };

    let cssVars = body.cssVars;
    let darkCssVars = body.darkCssVars;

    if (body.pasteInput) {
      const parsed = parseThemeInput(body.pasteInput);
      cssVars = parsed.cssVars;
      darkCssVars = parsed.darkCssVars;
    }

    const updated = await themeService.updateTheme(id, { name: body.name, cssVars, darkCssVars });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to update theme" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuth(request);
  if (!session) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const existing = await themeService.getThemeById(id);
  if (!existing) return NextResponse.json({ message: "Theme not found" }, { status: 404 });

  const isAdmin = session.user.role === "Admin";
  if (existing.type === "BUILTIN") {
    return NextResponse.json({ message: "Built-in themes cannot be deleted" }, { status: 403 });
  }
  if (existing.type === "COMPANY" && !isAdmin) {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }
  if (existing.type === "USER" && existing.userId !== session.user.id && !isAdmin) {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  await themeService.deleteTheme(id);
  return NextResponse.json({ success: true });
}
