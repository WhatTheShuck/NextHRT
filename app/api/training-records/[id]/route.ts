import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { writeFile, mkdir, unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { FILE_UPLOAD_CONFIG } from "@/lib/file-config";

// GET single training record
export const GET = auth(async function GET(
  request,
  props: { params: Promise<{ id: string }> },
) {
  if (!request.auth) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const params = await props.params;
  try {
    const id = parseInt(params.id);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: "Invalid training record ID" },
        { status: 400 },
      );
    }

    const trainingRecord = await prisma.trainingRecords.findUnique({
      where: { id },
      include: {
        personTrained: {
          include: {
            department: true,
            location: true,
          },
        },
        training: true,
      },
    });

    if (!trainingRecord) {
      return NextResponse.json(
        { error: "Training record not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(trainingRecord);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error fetching training record",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
});

// PUT update training record
export const PUT = auth(async function PUT(
  request,
  props: { params: Promise<{ id: string }> },
) {
  if (!request.auth) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const params = await props.params;
  try {
    const id = parseInt(params.id);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: "Invalid training record ID" },
        { status: 400 },
      );
    }

    // Get current record for history and file cleanup
    const currentRecord = await prisma.trainingRecords.findUnique({
      where: { id },
    });

    if (!currentRecord) {
      return NextResponse.json(
        { error: "Training record not found" },
        { status: 404 },
      );
    }

    const formData = await request.formData();

    // Extract form fields
    const employeeId = parseInt(formData.get("employeeId") as string);
    const trainingId = parseInt(formData.get("trainingId") as string);
    const dateCompleted = formData.get("dateCompleted") as string;
    const trainer = formData.get("trainer") as string;
    const imageFile = formData.get("image") as File | null;
    const removeImage = formData.get("removeImage") === "true"; // Flag to remove existing image

    // Validate required fields
    if (!employeeId || !trainingId || !dateCompleted || !trainer) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: employeeId, trainingId, dateCompleted, trainer",
        },
        { status: 400 },
      );
    }

    const completedDate = new Date(dateCompleted);

    // Get training details to calculate expiry date
    const training = await prisma.training.findUnique({
      where: { id: trainingId },
    });

    if (!training) {
      return NextResponse.json(
        { error: "Training course not found" },
        { status: 404 },
      );
    }

    // Check for duplicate record (excluding current record)
    const existingRecord = await prisma.trainingRecords.findFirst({
      where: {
        employeeId: employeeId,
        trainingId: trainingId,
        dateCompleted: completedDate,
        NOT: {
          id: id,
        },
      },
    });

    if (existingRecord) {
      return NextResponse.json(
        {
          error: "Training record already exists",
          details:
            "A training record with the same employee, training course, and completion date already exists.",
        },
        { status: 409 },
      );
    }

    // Handle file operations
    let imagePath: string | null = currentRecord.imagePath;
    let imageType: string | null = currentRecord.imageType;
    let oldImagePath: string | null = null;

    // If removing image or uploading new one, prepare to delete old file
    if (removeImage || (imageFile && imageFile.size > 0)) {
      oldImagePath = currentRecord.imagePath;
      imagePath = null;
      imageType = null;
    }

    // Process new file upload if present
    if (imageFile && imageFile.size > 0) {
      // Validate file
      if (!FILE_UPLOAD_CONFIG.ALLOWED_TYPES.includes(imageFile.type)) {
        return NextResponse.json(
          {
            error: `Invalid file type. Allowed types: ${FILE_UPLOAD_CONFIG.ALLOWED_TYPES_DISPLAY}`,
          },
          { status: 400 },
        );
      }

      if (imageFile.size > FILE_UPLOAD_CONFIG.MAX_FILE_SIZE) {
        return NextResponse.json(
          {
            error: `File too large. Maximum size is ${FILE_UPLOAD_CONFIG.MAX_FILE_SIZE_DISPLAY}`,
          },
          { status: 400 },
        );
      }

      try {
        // Create upload directory if it doesn't exist
        const uploadDir = path.join(process.cwd(), "uploads", "training");
        if (!existsSync(uploadDir)) {
          await mkdir(uploadDir, { recursive: true });
        }

        // Generate unique filename
        const fileExtension = path.extname(imageFile.name);
        const uniqueFilename = `${uuidv4()}${fileExtension}`;
        const filePath = path.join(uploadDir, uniqueFilename);

        // Convert file to buffer and save
        const bytes = await imageFile.arrayBuffer();
        const buffer = Buffer.from(bytes);
        await writeFile(filePath, buffer);

        // Store relative path for database
        imagePath = `training/${uniqueFilename}`;
        imageType = imageFile.type;
      } catch (fileError) {
        return NextResponse.json(
          {
            error: "Error saving file",
            details:
              fileError instanceof Error
                ? fileError.message
                : String(fileError),
          },
          { status: 500 },
        );
      }
    }

    const updatedTrainingRecord = await prisma.trainingRecords.update({
      where: { id },
      data: {
        employeeId: employeeId,
        trainingId: trainingId,
        dateCompleted: completedDate,
        trainer: trainer,
        imagePath: imagePath,
        imageType: imageType,
      },
      include: {
        personTrained: {
          include: {
            department: true,
            location: true,
          },
        },
        training: true,
      },
    });

    // Clean up old file if it was replaced or removed
    if (oldImagePath) {
      try {
        const oldFullPath = path.join(process.cwd(), "uploads", oldImagePath);
        if (existsSync(oldFullPath)) {
          await unlink(oldFullPath);
        }
      } catch (cleanupError) {
        // Log error but don't fail the request
        console.error("Error cleaning up old file:", cleanupError);
      }
    }

    // Create history record
    await prisma.history.create({
      data: {
        tableName: "TrainingRecords",
        recordId: id.toString(),
        action: "UPDATE",
        oldValues: JSON.stringify(currentRecord),
        newValues: JSON.stringify(updatedTrainingRecord),
        userId: request.auth.user?.id,
      },
    });

    return NextResponse.json(updatedTrainingRecord);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error updating training record",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
});

// DELETE training record
export const DELETE = auth(async function DELETE(
  request,
  props: { params: Promise<{ id: string }> },
) {
  if (!request.auth) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const params = await props.params;
  try {
    const id = parseInt(params.id);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: "Invalid training record ID" },
        { status: 400 },
      );
    }

    // Get current record for history before deletion
    const currentRecord = await prisma.trainingRecords.findUnique({
      where: { id },
    });

    if (!currentRecord) {
      return NextResponse.json(
        { error: "Training record not found" },
        { status: 404 },
      );
    }

    await prisma.trainingRecords.delete({
      where: { id },
    });

    // Clean up associated file if it exists
    if (currentRecord.imagePath) {
      try {
        const filePath = path.join(
          process.cwd(),
          "uploads",
          currentRecord.imagePath,
        );
        if (existsSync(filePath)) {
          await unlink(filePath);
        }
      } catch (cleanupError) {
        // Log error but don't fail the request since record is already deleted
        console.error("Error cleaning up file during deletion:", cleanupError);
      }
    }

    // Create history record
    await prisma.history.create({
      data: {
        tableName: "TrainingRecords",
        recordId: id.toString(),
        action: "DELETE",
        oldValues: JSON.stringify(currentRecord),
        userId: request.auth.user?.id,
      },
    });

    return NextResponse.json({
      message: "Training record deleted successfully",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error deleting training record",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
});
