import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/api-auth";
import prisma from "@/lib/prisma";

// Self-service toggle for ticket-expiry notification emails (spec §5.6).
// An admin opts themselves in/out; only ever updates their own User row.
export async function PUT(request: NextRequest) {
  const session = await getAuth(request);
  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const body = (await request.json()) as { receivesExpiryNotifications?: unknown };
  if (typeof body.receivesExpiryNotifications !== "boolean") {
    return NextResponse.json(
      { message: "receivesExpiryNotifications must be a boolean" },
      { status: 400 },
    );
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { receivesExpiryNotifications: body.receivesExpiryNotifications },
  });

  return NextResponse.json({ success: true });
}
