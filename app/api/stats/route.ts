import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/api-auth";
import { statsService } from "@/lib/services/statsService";

export async function GET(request: NextRequest) {
  const session = await getAuth(request);

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  try {
    const stats = await statsService.getStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error fetching statistics:", error);
    return NextResponse.json(
      { message: "Error fetching statistics" },
      { status: 500 },
    );
  }
}
