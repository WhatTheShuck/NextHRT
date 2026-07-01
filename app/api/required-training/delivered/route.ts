import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/api-auth";
import { requirementService } from "@/lib/services/requirementService";

export async function GET(request: NextRequest) {
  const session = await getAuth(request);

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  if (session.user.role !== "Admin") {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  try {
    const data = await requirementService.getDeliveredTrainingTracker(
      session.user.id,
      session.user.role,
    );
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load training tracker",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
