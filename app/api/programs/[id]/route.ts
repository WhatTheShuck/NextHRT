import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/api-auth";
import { programService } from "@/lib/services/programService";

// GET single program
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAuth(request);

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const programId = parseInt(id);
    const program = await programService.getProgramById(programId);
    return NextResponse.json(program);
  } catch (error) {
    if (error instanceof Error && error.message === "PROGRAM_NOT_FOUND") {
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }
    return NextResponse.json(
      {
        error: "Error fetching program",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

// PUT update program (Admin-only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAuth(request);

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  if (session.user.role !== "Admin") {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const programId = parseInt(id);
    const json = await request.json();
    const updatedProgram = await programService.updateProgram(
      programId,
      json,
      session.user.id,
    );
    return NextResponse.json(updatedProgram);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "PROGRAM_NOT_FOUND":
          return NextResponse.json(
            { error: "Program not found" },
            { status: 404 },
          );
        case "DUPLICATE_PROGRAM":
          return NextResponse.json(
            { error: "A program with this name already exists" },
            { status: 409 },
          );
      }
    }
    return NextResponse.json(
      {
        error: "Error updating program",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

// DELETE program (Admin-only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAuth(request);

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  if (session.user.role !== "Admin") {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const programId = parseInt(id);
    const result = await programService.deleteProgram(
      programId,
      session.user.id,
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "PROGRAM_NOT_FOUND") {
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }
    return NextResponse.json(
      {
        error: "Error deleting program",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
