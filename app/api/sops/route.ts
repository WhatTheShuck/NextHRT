import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAuth } from "@/lib/api-auth";
import { UserRole } from "@/generated/prisma_client/client";
import { sopService } from "@/lib/services/sopService";

// GET every SOP as one row per Task Sheet + Practical pair.
export async function GET(request: NextRequest) {
  const session = await getAuth(request);
  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const userRole = session.user.role as UserRole;
  const canEdit = await auth.api.userHasPermission({
    body: { role: userRole, permissions: { training: ["edit"] } },
  });
  if (!canEdit.success) {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  try {
    return NextResponse.json(await sopService.listSops());
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error fetching SOPs",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
