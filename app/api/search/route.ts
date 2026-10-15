import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/api-auth";
import { getSearchIndex } from "@/lib/services/searchService";

// GET the command palette's search index, pre-filtered to what this user may open
export async function GET(request: NextRequest) {
  const session = await getAuth(request);
  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  try {
    const index = await getSearchIndex(
      session.user.id,
      session.user.role ?? "User",
    );
    return NextResponse.json(index, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error building search index",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
