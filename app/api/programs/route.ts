import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/api-auth";
import { programService } from "@/lib/services/programService";

export async function GET(request: NextRequest) {
  const session = await getAuth(request);

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get("activeOnly") === "true";

  try {
    const programs = await programService.getPrograms({ activeOnly });
    return NextResponse.json(programs);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error fetching programs",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

// POST new program (Admin-only)
export async function POST(request: NextRequest) {
  const session = await getAuth(request);

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  if (session.user.role !== "Admin") {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  try {
    const json = await request.json();
    const program = await programService.createProgram(json, session.user.id);
    return NextResponse.json(program);
  } catch (error) {
    if (error instanceof Error && error.message === "DUPLICATE_PROGRAM") {
      return NextResponse.json(
        { error: "A program with this name already exists" },
        { status: 409 },
      );
    }
    return NextResponse.json(
      {
        error: "Error creating program",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
