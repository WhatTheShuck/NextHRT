import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/api-auth";
import { accountOnboardingService } from "@/lib/services/accountOnboardingService";

// Which employees in the caller's managed departments have an HRT account.
// Scoped by managedDepartments, so anyone who manages nothing gets null.
export async function GET(request: NextRequest) {
  const session = await getAuth(request);
  if (!session) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });

  try {
    const members = await accountOnboardingService.getTeamAccountStatus(session.user.id);
    return NextResponse.json({ members });
  } catch {
    return NextResponse.json({ error: "Failed to fetch team account status" }, { status: 500 });
  }
}
