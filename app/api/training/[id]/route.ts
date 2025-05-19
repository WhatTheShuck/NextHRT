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
    await prisma.training.delete({
      where: { id },
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
