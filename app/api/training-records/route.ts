import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { UserRole } from "@/generated/prisma_client";
import { trainingRecordService } from "@/lib/services/trainingRecordService";
import { FILE_UPLOAD_CONFIG } from "@/lib/file-config";

// GET all training records
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get("activeOnly") === "true";
  const userRole = session.user.role as UserRole;
  const userId = session.user.id;

  try {
    const trainingRecords = await trainingRecordService.getTrainingRecords({
      activeOnly,
      userRole,
      userId,
    });
    return NextResponse.json(trainingRecords);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "USER_NOT_FOUND":
          return NextResponse.json(
            { message: "User not found" },
            { status: 404 },
          );
        case "NO_EMPLOYEE_RECORD":
          return NextResponse.json(
            { message: "No associated employee record" },
            { status: 403 },
          );
      }
    }
    return NextResponse.json(
      {
        error: "Error fetching training records",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

// POST new training record
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const userRole = session.user.role as UserRole;

  // Only Admins can create training records
  if (userRole !== "Admin") {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  try {
    const formData = await request.formData();

    const data = {
      employeeId: parseInt(formData.get("employeeId") as string),
      trainingId: parseInt(formData.get("trainingId") as string),
      dateCompleted: formData.get("dateCompleted") as string,
      trainer: formData.get("trainer") as string,
    };
    const imageFile = formData.get("image") as File | null;

    const trainingRecord = await trainingRecordService.createTrainingRecord(
      data,
      imageFile,
      session.user.id,
    );
    return NextResponse.json(trainingRecord);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "MISSING_REQUIRED_FIELDS":
          return NextResponse.json(
            {
              error:
                "Missing required fields: employeeId, trainingId, dateCompleted, trainer",
            },
            { status: 400 },
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
        case "TRAINING_NOT_FOUND":
          return NextResponse.json(
            { error: "Training course not found" },
            { status: 404 },
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
        error: "Error creating training record",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
