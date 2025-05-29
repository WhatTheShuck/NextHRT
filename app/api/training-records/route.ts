import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { FILE_UPLOAD_CONFIG } from "@/lib/file-config";

// GET all training records
export const GET = auth(async function GET(request) {
  if (!request.auth) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  try {
    const trainingRecords = await prisma.trainingRecords.findMany({
      include: {
        personTrained: {
          include: {
            department: true,
            location: true,
          },
        },
        training: true,
      },
      orderBy: {
        dateCompleted: "desc",
      },
    });
    return NextResponse.json(trainingRecords);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error fetching training records",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
});

// POST new training record
export const POST = auth(async function POST(request) {
  if (!request.auth) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  try {
    const formData = await request.formData();

    // Extract form fields
    const employeeId = parseInt(formData.get("employeeId") as string);
    const trainingId = parseInt(formData.get("trainingId") as string);
    const dateCompleted = formData.get("dateCompleted") as string;
    const trainer = formData.get("trainer") as string;
    const imageFile = formData.get("image") as File | null;

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

    // Check for existing record with same employee, training, and date (unique constraint)
    const existingRecord = await prisma.trainingRecords.findFirst({
      where: {
        employeeId: employeeId,
        trainingId: trainingId,
        dateCompleted: completedDate,
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

    // Process file upload if present
    let imagePath: string | null = null;
    let imageType: string | null = null;

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

    // Calculate expiry date based on renewal period
    let expiryDate = null;
    if (training.renewalPeriod > 0) {
      expiryDate = new Date(completedDate);
      expiryDate.setMonth(expiryDate.getMonth() + training.renewalPeriod);
    }

    const trainingRecord = await prisma.trainingRecords.create({
      data: {
        employeeId: employeeId,
        trainingId: trainingId,
        dateCompleted: completedDate,
        expiryDate: expiryDate,
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

    // Create history record
    await prisma.history.create({
      data: {
        tableName: "TrainingRecords",
        recordId: trainingRecord.id,
        action: "CREATE",
        newValues: JSON.stringify(trainingRecord),
        userId: request.auth.user?.id,
      },
    });

    return NextResponse.json(trainingRecord);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error creating training record",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
});
