import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

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

  const whereClause: any = {};
  if (activeOnly) {
    whereClause.isActive = true;
  }
  if (category) {
    whereClause.category = category;
  }

  const includeClause: any = {
    _count: {
      select: { trainingRecords: true },
    },
  };

  if (includeRequirements) {
    includeClause.requirements = {
      include: {
        training: true,
        department: true,
        location: true,
      },
    };
    includeClause.trainingExemptions = {
      include: {
        training: true,
        employee: true,
      },
    };
  }

  try {
    const trainings = await prisma.training.findMany({
      include: includeClause,
      where: whereClause,
      orderBy: {
        title: "asc",
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
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  try {
    const json = await request.json();
    if (json.category === "SOP") {
      const training1 = await prisma.training.create({
        data: {
          category: json.category,
          title: json.title + " - Task Sheet",
        },
      });

      const training2 = await prisma.training.create({
        data: {
          category: json.category,
          title: json.title + " - Practical",
        },
      });

      // Create requirements for both trainings
      if (json.requirements) {
        for (const req of json.requirements) {
          // For training1
          await prisma.trainingRequirement.create({
            data: {
              trainingId: training1.id,
              departmentId: req.departmentId,
              locationId: req.locationId,
            },
          });

          // For training2
          await prisma.trainingRequirement.create({
            data: {
              trainingId: training2.id,
              departmentId: req.departmentId,
              locationId: req.locationId,
            },
          });
        }
      }

      // Create history records for both trainings
      await prisma.history.create({
        data: {
          tableName: "Training",
          recordId: training1.id.toString(),
          action: "CREATE",
          newValues: JSON.stringify(training1),
          userId: session.user.id,
        },
      });

      await prisma.history.create({
        data: {
          tableName: "Training",
          recordId: training2.id.toString(),
          action: "CREATE",
          newValues: JSON.stringify(training2),
          userId: session.user.id,
        },
      });

      // Return both trainings or just the first one, depending on your frontend needs
      return NextResponse.json([training1, training2]);
    } else {
      const training = await prisma.training.create({
        data: {
          category: json.category,
          title: json.title,
        },
      });
      if (json.requirements) {
        for (const req of json.requirements) {
          await prisma.trainingRequirement.create({
            data: {
              trainingId: training.id,
              departmentId: req.departmentId,
              locationId: req.locationId,
            },
          });
        }
      }
      // Create history record
      await prisma.history.create({
        data: {
          tableName: "Training",
          recordId: training.id.toString(),
          action: "CREATE",
          newValues: JSON.stringify(training),
          userId: session.user.id,
        },
      });

      return NextResponse.json(training);
    }
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
