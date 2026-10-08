import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/api-auth";
import { accountOnboardingService } from "@/lib/services/accountOnboardingService";

// Dismiss the one-time dashboard welcome. Only ever touches the caller's row.
export async function DELETE(request: NextRequest) {
  const session = await getAuth(request);
  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  await accountOnboardingService.dismissWelcome(session.user.id);
  return NextResponse.json({ success: true });
}
