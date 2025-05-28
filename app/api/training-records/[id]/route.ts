import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

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

    // Get current record for history
    const currentRecord = await prisma.trainingRecords.findUnique({
      where: { id },
    });

    if (!currentRecord) {
      return NextResponse.json(
        { error: "Training record not found" },
        { status: 404 },
      );
    }

    const dateCompleted = new Date(json.dateCompleted);

    // Get training details to calculate expiry date
    const training = await prisma.training.findUnique({
      where: { id: json.trainingId },
    });

    if (!training) {
      return NextResponse.json(
        { error: "Training course not found" },
        { status: 404 },
      );
    }

    // Calculate expiry date based on renewal period
    let expiryDate = null;
    if (training.renewalPeriod > 0) {
      expiryDate = new Date(dateCompleted);
      expiryDate.setMonth(expiryDate.getMonth() + training.renewalPeriod);
    }

    // Check for duplicate record (excluding current record)
    const existingRecord = await prisma.trainingRecords.findFirst({
      where: {
        employeeId: json.employeeId,
        trainingId: json.trainingId,
        dateCompleted: dateCompleted,
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

    const updatedTrainingRecord = await prisma.trainingRecords.update({
      where: { id },
      data: {
        employeeId: json.employeeId,
        trainingId: json.trainingId,
        dateCompleted: dateCompleted,
        expiryDate: expiryDate,
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
        recordId: id,
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

    // Create history record
    await prisma.history.create({
      data: {
        tableName: "TrainingRecords",
        recordId: id,
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
