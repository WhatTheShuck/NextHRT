import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET single training course
export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const id = parseInt(params.id);
    const training = await prisma.training.findUnique({
      where: { id },
      include: {
        TrainingRecords: {
          include: {
            personTrained: true,
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
      { error: "Error fetching training course" },
      { status: 500 },
    );
  }
}

// PUT update training course
export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const id = parseInt(params.id);
    const json = await request.json();

    const updatedTraining = await prisma.training.update({
      where: { id },
      data: {
        category: json.category,
        title: json.title,
        RenewalPeriod: json.RenewalPeriod,
      },
    });

    return NextResponse.json(updatedTraining);
  } catch (error) {
    return NextResponse.json(
      { error: "Error updating training course" },
      { status: 500 },
    );
  }
}

// DELETE training course
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const id = parseInt(params.id);
    await prisma.training.delete({
      where: { id },
    });

    return NextResponse.json({
      message: "Training course deleted successfully",
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Error deleting training course" },
      { status: 500 },
    );
  }
}
