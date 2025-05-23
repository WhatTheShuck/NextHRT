import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

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
    const json = await request.json();

    // Validate required fields
    if (
      !json.employeeId ||
      !json.trainingId ||
      !json.dateCompleted ||
      !json.trainer
    ) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: employeeId, trainingId, dateCompleted, trainer",
        },
        { status: 400 },
      );
    }

    const dateCompleted = new Date(json.dateCompleted);

    // Check for existing record with same employee, training, and date (unique constraint)
    const existingRecord = await prisma.trainingRecords.findFirst({
      where: {
        employeeId: json.employeeId,
        trainingId: json.trainingId,
        dateCompleted: dateCompleted,
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

    const trainingRecord = await prisma.trainingRecords.create({
      data: {
        employeeId: json.employeeId,
        trainingId: json.trainingId,
        dateCompleted: dateCompleted,
        trainer: json.trainer,
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
