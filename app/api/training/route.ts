import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET all training courses
export async function GET() {
  try {
    const trainings = await prisma.training.findMany({
      include: {
        TrainingRecords: true,
      },
    });
    return NextResponse.json(trainings);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error fetching training courses",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

// POST new training course
export async function POST(request: Request) {
  try {
    const json = await request.json();
    const training = await prisma.training.create({
      data: {
        category: json.category,
        title: json.title,
        RenewalPeriod: json.RenewalPeriod || 0,
      },
    });
    return NextResponse.json(training);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error creating training course",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
