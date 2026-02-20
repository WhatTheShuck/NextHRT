import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { UserRole } from "@/generated/prisma_client";
import { trainingRecordService } from "@/lib/services/trainingRecordService";
import { FILE_UPLOAD_CONFIG } from "@/lib/file-config";

// GET single training record
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

  try {
    const id = parseInt(idParam);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: "Invalid training record ID" },
        { status: 400 },
      );
    }

    const trainingRecord =
      await trainingRecordService.getTrainingRecordById(id);
    return NextResponse.json(trainingRecord);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "TRAINING_RECORD_NOT_FOUND":
          return NextResponse.json(
            { error: "Training record not found" },
            { status: 404 },
          );
      }
    }
    return NextResponse.json(
      {
        error: "Error fetching training record",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

// PUT update training record
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
    body: { role: userRole, permissions: { trainingRecord: ["edit"] } },
  });

  if (!canEdit) {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  try {
    const id = parseInt(idParam);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: "Invalid training record ID" },
        { status: 400 },
      );
    }

    const formData = await request.formData();

    const data = {
      employeeId: parseInt(formData.get("employeeId") as string),
      trainingId: parseInt(formData.get("trainingId") as string),
      dateCompleted: formData.get("dateCompleted") as string,
      trainer: formData.get("trainer") as string,
      removeImage: formData.get("removeImage") === "true",
    };
    const imageFile = formData.get("image") as File | null;

    const updatedTrainingRecord =
      await trainingRecordService.updateTrainingRecord(
        id,
        data,
        imageFile,
        session.user.id,
      );
    return NextResponse.json(updatedTrainingRecord);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "TRAINING_RECORD_NOT_FOUND":
          return NextResponse.json(
            { error: "Training record not found" },
            { status: 404 },
          );
        case "MISSING_REQUIRED_FIELDS":
          return NextResponse.json(
            {
              error:
                "Missing required fields: employeeId, trainingId, dateCompleted, trainer",
            },
            { status: 400 },
          );
        case "TRAINING_NOT_FOUND":
          return NextResponse.json(
            { error: "Training course not found" },
            { status: 404 },
          );
        case "DUPLICATE_TRAINING_RECORD":
          return NextResponse.json(
            {
              error: "Training record already exists",
              details:
                "A training record with the same employee, training course, and completion date already exists.",
            },
            { status: 409 },
          );
        case "INVALID_FILE_TYPE":
          return NextResponse.json(
            {
              error: `Invalid file type. Allowed types: ${FILE_UPLOAD_CONFIG.ALLOWED_TYPES_DISPLAY}`,
            },
            { status: 400 },
          );
        case "FILE_TOO_LARGE":
          return NextResponse.json(
            {
              error: `File too large. Maximum size is ${FILE_UPLOAD_CONFIG.MAX_FILE_SIZE_DISPLAY}`,
            },
            { status: 400 },
          );
        case "FILE_SAVE_ERROR":
          return NextResponse.json(
            { error: "Error saving file" },
            { status: 500 },
          );
      }
    }
    return NextResponse.json(
      {
        error: "Error updating training record",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

// DELETE training record
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
    body: { role: userRole, permissions: { trainingRecord: ["delete"] } },
  });

  if (!canDelete) {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  try {
    const id = parseInt(idParam);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: "Invalid training record ID" },
        { status: 400 },
      );
    }

    const result = await trainingRecordService.deleteTrainingRecord(
      id,
      session.user.id,
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "TRAINING_RECORD_NOT_FOUND":
          return NextResponse.json(
            { error: "Training record not found" },
            { status: 404 },
          );
      }
    }
    return NextResponse.json(
      {
        error: "Error deleting training record",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
