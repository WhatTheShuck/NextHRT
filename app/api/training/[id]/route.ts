import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { UserRole } from "@/generated/prisma_client";

// GET single training course
export const GET = auth(async function GET(
  request,
  props: { params: Promise<{ id: string }> },
) {
  if (!request.auth) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const params = await props.params;
  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get("activeOnly") === "true";
  const includeRequirements =
    searchParams.get("includeRequirements") === "true";
  const whereClause: any = {};
  if (activeOnly) {
    whereClause.isActive = true;
  }

  const includeClause: any = {
    trainingRecords: {
      include: {
        personTrained: {
          include: {
            department: true,
            location: true,
          },
        },
      },
      where: whereClause,
      orderBy: {
        dateCompleted: "desc",
      },
    },

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
    const id = parseInt(params.id);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: "Invalid training ID" },
        { status: 400 },
      );
    }

    const training = await prisma.training.findUnique({
      where: { id },
      include: includeClause,
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
  req,
  props: { params: Promise<{ id: string }> },
) {
  if (!req.auth) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const params = await props.params;

  const userRole = req.auth.user?.role as UserRole;

  // Only Admins can edit employee records
  if (userRole !== "Admin") {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  try {
    const id = parseInt(params.id);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: "Invalid training ID" },
        { status: 400 },
      );
    }

    const json = await req.json();

    // Get the current training record for history
    const currentTraining = await prisma.training.findUnique({
      where: { id },
      include: {
        requirements: true,
      },
    });

    if (!currentTraining) {
      return NextResponse.json(
        { error: "Training course not found" },
        { status: 404 },
      );
    }

    // Check if we're changing from non-SOP to SOP category
    if (currentTraining.category !== "SOP" && json.category === "SOP") {
      // Update the existing record to be the "Task Sheet" version
      const updatedTraining = await prisma.training.update({
        where: { id },
        data: {
          category: json.category,
          title: json.title + " - Task Sheet",
          isActive: json.isActive,
        },
      });

      // Create the matching "Practical" record
      const practicalTraining = await prisma.training.create({
        data: {
          category: json.category,
          title: json.title + " - Practical",
          isActive: json.isActive,
        },
      });

      // Handle requirements for both trainings
      if (json.requirements) {
        // Delete existing requirements from the original training
        await prisma.trainingRequirement.deleteMany({
          where: { trainingId: id },
        });

        // Add new requirements to both trainings
        for (const req of json.requirements) {
          // For the updated training (Task Sheet)
          await prisma.trainingRequirement.create({
            data: {
              trainingId: updatedTraining.id,
              departmentId: req.departmentId,
              locationId: req.locationId,
            },
          });

          // For the new practical training
          await prisma.trainingRequirement.create({
            data: {
              trainingId: practicalTraining.id,
              departmentId: req.departmentId,
              locationId: req.locationId,
            },
          });
        }
      } else {
        // If no new requirements provided, copy existing requirements to both trainings
        await prisma.trainingRequirement.deleteMany({
          where: { trainingId: id },
        });

        for (const req of currentTraining.requirements) {
          // For the updated training (Task Sheet)
          await prisma.trainingRequirement.create({
            data: {
              trainingId: updatedTraining.id,
              departmentId: req.departmentId,
              locationId: req.locationId,
            },
          });

          // For the new practical training
          await prisma.trainingRequirement.create({
            data: {
              trainingId: practicalTraining.id,
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
          recordId: id.toString(),
          action: "UPDATE",
          oldValues: JSON.stringify(currentTraining),
          newValues: JSON.stringify(updatedTraining),
          userId: req.auth.user?.id,
        },
      });

      await prisma.history.create({
        data: {
          tableName: "Training",
          recordId: practicalTraining.id.toString(),
          action: "CREATE",
          newValues: JSON.stringify(practicalTraining),
          userId: req.auth.user?.id,
        },
      });

      // Return both trainings
      return NextResponse.json([updatedTraining, practicalTraining]);
    }
    // Handle normal updates (including SOP to SOP updates)
    else {
      const updatedTraining = await prisma.training.update({
        where: { id },
        data: {
          category: json.category,
          title: json.title,
          isActive: json.isActive,
        },
      });

      // Create history record
      await prisma.history.create({
        data: {
          tableName: "Training",
          recordId: id.toString(),
          action: "UPDATE",
          oldValues: JSON.stringify(currentTraining),
          newValues: JSON.stringify(updatedTraining),
          userId: req.auth.user?.id,
        },
      });

      if (json.requirements) {
        // Delete existing requirements
        await prisma.trainingRequirement.deleteMany({
          where: { trainingId: id },
        });

        // Add new requirements
        for (const req of json.requirements) {
          await prisma.trainingRequirement.create({
            data: {
              trainingId: updatedTraining.id,
              departmentId: req.departmentId,
              locationId: req.locationId,
            },
          });
        }
      }

      return NextResponse.json(updatedTraining);
    }
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
  req,
  props: { params: Promise<{ id: string }> },
) {
  if (!req.auth) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const params = await props.params;

  const userRole = req.auth.user?.role as UserRole;

  // Only Admins can delete employee records
  if (userRole !== "Admin") {
    return NextResponse.json({ message: "Not authorized" }, { status: 403 });
  }
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
    await prisma.trainingRequirement.deleteMany({
      where: { trainingId: id },
    });
    // Create history record
    await prisma.history.create({
      data: {
        tableName: "Training",
        recordId: id.toString(),
        action: "DELETE",
        oldValues: JSON.stringify(currentTraining),
        userId: req.auth.user?.id,
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
