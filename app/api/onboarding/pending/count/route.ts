import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/api-auth";
import { onboardingService } from "@/lib/services/onboardingService";

export async function GET(request: NextRequest) {
  const session = await getAuth(request);
  if (!session) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  if (session.user.role !== "Admin") return NextResponse.json({ count: 0 });

  try {
    const count = await onboardingService.getPendingCount();
    return NextResponse.json({ count });
  } catch {
    return NextResponse.json({ error: "Failed to fetch count" }, { status: 500 });
  }
}
