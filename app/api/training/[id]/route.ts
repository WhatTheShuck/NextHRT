import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { UserRole } from "@/generated/prisma_client";
import { trainingService } from "@/lib/services/trainingService";

// GET single training course
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const { id: idParam } = await params;
  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get("activeOnly") === "true";
  const includeRequirements =
    searchParams.get("includeRequirements") === "true";
  const includeRecords = searchParams.get("records") === "true";

  try {
    const id = parseInt(idParam);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: "Invalid training ID" },
        { status: 400 },
      );
    }

    const training = await trainingService.getTrainingById(id, {
      activeOnly,
      includeRequirements,
      includeRecords,
    });
    return NextResponse.json(training);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "TRAINING_NOT_FOUND":
          return NextResponse.json(
            { error: "Training course not found" },
            { status: 404 },
          );
      }
    }
    return NextResponse.json(
      {
        error: "Error fetching training course",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

// PUT update training course
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const { id: idParam } = await params;
  const userRole = session.user.role as UserRole;

  const canEdit = await auth.api.userHasPermission({
    body: { role: userRole, permissions: { training: ["edit"] } },
  });

  if (!canEdit) {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  try {
    const id = parseInt(idParam);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: "Invalid training ID" },
        { status: 400 },
      );
    }

    const json = await request.json();
    const result = await trainingService.updateTraining(
      id,
      json,
      session.user.id,
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "TRAINING_NOT_FOUND":
          return NextResponse.json(
            { error: "Training course not found" },
            { status: 404 },
          );
      }
    }
    return NextResponse.json(
      {
        error: "Error updating training course",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

// DELETE training course
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const { id: idParam } = await params;
  const userRole = session.user.role as UserRole;

  const canDelete = await auth.api.userHasPermission({
    body: { role: userRole, permissions: { training: ["delete"] } },
  });

  if (!canDelete) {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  try {
    const id = parseInt(idParam);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: "Invalid training ID" },
        { status: 400 },
      );
    }

    const result = await trainingService.deleteTraining(id, session.user.id);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "TRAINING_NOT_FOUND":
          return NextResponse.json(
            { error: "Training course not found" },
            { status: 404 },
          );
        case "TRAINING_HAS_RECORDS":
          return NextResponse.json(
            {
              error:
                "Cannot delete training course with existing training records",
            },
            { status: 400 },
          );
      }
    }
    return NextResponse.json(
      {
        error: "Error deleting training course",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
