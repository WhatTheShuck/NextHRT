import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { UserRole } from "@/generated/prisma_client";

// GET all locations
export const GET = auth(async function GET(req) {
  // Check if the user is authenticated
  if (!req.auth) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  try {
    const locations = await prisma.location.findMany({
      include: {
        _count: {
          select: { employees: true },
        },
      },
      orderBy: [
        {
          state: "asc",
        },
        {
          name: "asc",
        },
      ],
    });
    return NextResponse.json(locations);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error fetching locations",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
});

// POST new location
export const POST = auth(async function POST(request) {
  // Check if the user is authenticated
  if (!request.auth) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const userRole = request.auth.user?.role as UserRole;
  const userId = request.auth.user?.id;

  // Only Admins can create locations
  if (userRole !== "Admin") {
    return NextResponse.json({ message: "Not authorized" }, { status: 403 });
  }

  try {
    const json = await request.json();

    const location = await prisma.location.create({
      data: {
        name: json.name,
        state: json.state,
      },
    });

    // Create history record
    await prisma.history.create({
      data: {
        tableName: "Location",
        recordId: location.id,
        action: "CREATE",
        newValues: JSON.stringify(location),
        userId: userId,
      },
    });

    return NextResponse.json(location);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error creating location",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
});
