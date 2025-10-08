import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { FILE_UPLOAD_CONFIG } from "@/lib/file-config";
import { UserRole } from "@/generated/prisma_client";

// GET all training records
export const GET = auth(async function GET(req) {
  if (!req.auth) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);

  const activeOnly = searchParams.get("activeOnly") === "true";

  const userRole = req.auth.user?.role as UserRole;
  const userId = req.auth.user?.id;

  // Build the where clause for filtering
  const whereClause: any = {};

  if (activeOnly) {
    whereClause.training = {
      isActive: true,
    };
  }

  try {
    // Different query based on user role
    if (userRole === "Admin") {
      // Admins can see all employee records
      const trainingRecords = await prisma.trainingRecords.findMany({
        where: whereClause,
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
    } else if (userRole === "DepartmentManager") {
      // Department managers can see employees in their departments
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { managedDepartments: true },
      });

      if (!user) {
        return NextResponse.json(
          { message: "User not found" },
          { status: 404 },
        );
      }

      const departmentIds = user.managedDepartments.map((dept) => dept.id);

      const employees = await prisma.employee.findMany({
        where: {
          departmentId: { in: departmentIds },
        },
        include: {
          department: true,
          location: true,
        },
        orderBy: {
          lastName: "asc",
        },
      });
      const employeeIds = employees.map((emp) => emp.id);

      const trainingRecords = await prisma.trainingRecords.findMany({
        where: {
          employeeId: { in: employeeIds },
          ...whereClause,
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
        orderBy: {
          dateCompleted: "desc",
        },
      });
      return NextResponse.json(trainingRecords);
    } else {
      // Regular users can only see themselves
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { employee: true },
      });

      if (!user || !user.employee) {
        return NextResponse.json(
          { message: "No associated employee record" },
          { status: 403 },
        );
      }

      const trainingRecords = await prisma.trainingRecords.findMany({
        where: {
          employeeId: user.employee.id,
          ...whereClause,
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
        orderBy: {
          dateCompleted: "desc",
        },
      });
      return NextResponse.json(trainingRecords);
    }
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
export const POST = auth(async function POST(req) {
  if (!req.auth) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }
  const userRole = req.auth.user?.role as UserRole;

  // Only Admins can create employee records
  if (userRole !== "Admin") {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }
  try {
    const formData = await req.formData();

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

    const trainingRecord = await prisma.trainingRecords.create({
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

    // Create history record
    await prisma.history.create({
      data: {
        tableName: "TrainingRecords",
        recordId: trainingRecord.id.toString(),
        action: "CREATE",
        newValues: JSON.stringify(trainingRecord),
        userId: req.auth.user?.id,
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
