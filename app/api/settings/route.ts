import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { appSettingService } from "@/lib/services/appSettingService";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  if (session.user.role !== "Admin") {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  const settings = await appSettingService.getSettings();
  return NextResponse.json(settings);
}

export async function PUT(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  if (session.user.role !== "Admin") {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const updates: { key: string; value: string }[] = body.updates;

    if (!Array.isArray(updates)) {
      return NextResponse.json(
        { message: "Invalid request body — expected { updates: [...] }" },
        { status: 400 },
      );
    }

    await appSettingService.bulkUpdateSettings(updates, session.user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to update settings",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
