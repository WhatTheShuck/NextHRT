import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { UserRole } from "@/generated/prisma_client";
import { historyService } from "@/lib/services/historyService";

// GET all history records (with optional filtering)
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const userId = session.user.id;
  const userRole = session.user.role as UserRole;

  const canViewHistory = await auth.api.userHasPermission({
    body: { role: userRole, permissions: { reports: ["viewEmployee"] } },
  });

  if (!canViewHistory) {
    return NextResponse.json(
      { error: "Not authorised to view history records" },
      { status: 403 },
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get("limit");
    const offset = searchParams.get("offset");

    const result = await historyService.getHistory({
      tableName: searchParams.get("tableName"),
      recordId: searchParams.get("recordId"),
      action: searchParams.get("action"),
      limit: limit ? parseInt(limit) : null,
      offset: offset ? parseInt(offset) : null,
      userId,
      userRole,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "NO_MANAGED_DEPARTMENTS":
          return NextResponse.json(
            { error: "No managed departments found" },
            { status: 403 },
          );
      }
    }
    return NextResponse.json(
      {
        error: "Error fetching history records",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
