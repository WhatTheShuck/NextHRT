import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { appSettingService } from "@/lib/services/appSettingService";

export async function PUT(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });

  const settings = await appSettingService.getSettings();
  if (settings["theme.lock"] === "true" && session.user.role !== "Admin") {
    return NextResponse.json({ message: "Theme is locked by administrator" }, { status: 403 });
  }

  const body = await request.json() as { themeId: string | null };
  await prisma.user.update({
    where: { id: session.user.id },
    data: { themeId: body.themeId },
  });

  return NextResponse.json({ success: true });
}
