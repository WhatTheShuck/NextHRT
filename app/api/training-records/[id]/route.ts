import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET single training record
export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const id = parseInt(params.id);
    const trainingRecord = await prisma.trainingRecords.findUnique({
      where: { id },
      include: {
        personTrained: true,
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
      { error: "Error fetching training record" },
      { status: 500 },
    );
  }
}

// PUT update training record
export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const id = parseInt(params.id);
    const json = await request.json();

    // Get the training details to recalculate expiry date if needed
    const training = await prisma.training.findUnique({
      where: { id: json.trainingId },
    });

    const dateCompleted = new Date(json.dateCompleted);
    let expiryDate = null;

    if (training && training.RenewalPeriod > 0) {
      expiryDate = new Date(dateCompleted);
      expiryDate.setMonth(expiryDate.getMonth() + training.RenewalPeriod);
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
        personTrained: true,
        training: true,
      },
    });

    return NextResponse.json(updatedTrainingRecord);
  } catch (error) {
    return NextResponse.json(
      { error: "Error updating training record" },
      { status: 500 },
    );
  }
}

// DELETE training record
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const id = parseInt(params.id);
    await prisma.trainingRecords.delete({
      where: { id },
    });

    return NextResponse.json({
      message: "Training record deleted successfully",
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Error deleting training record" },
      { status: 500 },
    );
  }
}
