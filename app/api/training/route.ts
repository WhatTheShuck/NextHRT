import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { trainingService } from "@/lib/services/trainingService";

// GET all training courses
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get("activeOnly") === "true";
  const category = searchParams.get("category");
  const includeRequirements =
    searchParams.get("includeRequirements") === "true";

  try {
    const trainings = await trainingService.getTrainings({
      activeOnly,
      category,
      includeRequirements,
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
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  try {
    const json = await request.json();
    const training = await trainingService.createTraining(
      json,
      session.user.id,
    );
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
