import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET all training courses
export const GET = auth(async function GET(request) {
  // Check if the user is authenticated
  if (!request.auth) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }
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
});

// POST new training course
export const POST = auth(async function POST(request) {
  if (!request.auth) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }
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
});
