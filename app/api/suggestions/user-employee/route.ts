import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { matchingService } from "@/lib/services/matchingService";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  if (session.user.role !== "Admin") {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  try {
    const suggestions = await matchingService.getSuggestions();
    return NextResponse.json(suggestions);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to generate suggestions",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
