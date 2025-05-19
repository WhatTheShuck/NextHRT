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
        personTrained: true,
        training: true,
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

    // Get the training details to calculate expiry date
    const training = await prisma.training.findUnique({
      where: { id: json.trainingId },
    });

    const dateCompleted = new Date(json.dateCompleted);
    let expiryDate = null;

    if (training && training.RenewalPeriod > 0) {
      expiryDate = new Date(dateCompleted);
      expiryDate.setMonth(expiryDate.getMonth() + training.RenewalPeriod);
    }

    const trainingRecord = await prisma.trainingRecords.create({
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
