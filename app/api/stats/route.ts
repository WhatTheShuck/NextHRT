import { NextRequest, NextResponse } from "next/server";
import { statsService } from "@/lib/services/statsService";

export async function GET(request: NextRequest) {
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
