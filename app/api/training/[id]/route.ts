import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET single training course
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
        { error: "Invalid training ID" },
        { status: 400 },
      );
    }

    const training = await prisma.training.findUnique({
      where: { id },
      include: {
        trainingRecords: {
          include: {
            personTrained: {
              include: {
                department: true,
                location: true,
              },
            },
          },
          orderBy: {
            dateCompleted: "desc",
          },
        },
      },
    });

    if (!training) {
      return NextResponse.json(
        { error: "Training course not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(training);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error fetching training course",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
});

// PUT update training course
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
        { error: "Invalid training ID" },
        { status: 400 },
      );
    }

    const json = await request.json();

    // Get the current training record for history
    const currentTraining = await prisma.training.findUnique({
      where: { id },
    });

    if (!currentTraining) {
      return NextResponse.json(
        { error: "Training course not found" },
        { status: 404 },
      );
    }

    const updatedTraining = await prisma.training.update({
      where: { id },
      data: {
        category: json.category,
        title: json.title,
      },
    });

    // Create history record
    await prisma.history.create({
      data: {
        tableName: "Training",
        recordId: id,
        action: "UPDATE",
        oldValues: JSON.stringify(currentTraining),
        newValues: JSON.stringify(updatedTraining),
        userId: request.auth.user?.id,
      },
    });

    return NextResponse.json(updatedTraining);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error updating training course",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
});

// DELETE training course
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
        { error: "Invalid training ID" },
        { status: 400 },
      );
    }

    // Get the current training record for history before deletion
    const currentTraining = await prisma.training.findUnique({
      where: { id },
    });

    if (!currentTraining) {
      return NextResponse.json(
        { error: "Training course not found" },
        { status: 404 },
      );
    }

    // Check if there are any training records associated with this training
    const trainingRecordsCount = await prisma.trainingRecords.count({
      where: { trainingId: id },
    });

    if (trainingRecordsCount > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete training course with existing training records",
          details: `This training course has ${trainingRecordsCount} associated training record(s). Please remove all training records before deleting the course.`,
        },
        { status: 400 },
      );
    }

    await prisma.training.delete({
      where: { id },
    });

    // Create history record
    await prisma.history.create({
      data: {
        tableName: "Training",
        recordId: id,
        action: "DELETE",
        oldValues: JSON.stringify(currentTraining),
        userId: request.auth.user?.id,
      },
    });

    return NextResponse.json({
      message: "Training course deleted successfully",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error deleting training course",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
});
