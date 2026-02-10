import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { UserRole } from "@/generated/prisma_client";

// GET single location
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get("activeOnly") === "true";

  try {
    const locationId = parseInt(id);
    const location = await prisma.location.findUnique({
      where: { id: locationId },
      include: {
        employees: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            title: true,
            department: {
              select: {
                name: true,
              },
            },
          },
          where: activeOnly
            ? {
                isActive: true,
              }
            : undefined,
        },
        _count: {
          select: { employees: true },
        },
      },
    });

    if (!location) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(location);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error fetching location",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

// PUT update location
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const userRole = session.user.role as UserRole;
  const userId = session.user.id;

  // Only Admins can update locations
  if (userRole !== "Admin") {
    return NextResponse.json({ message: "Not authorized" }, { status: 403 });
  }

  try {
    const locationId = parseInt(id);

    // Get current location data for history
    const currentLocation = await prisma.location.findUnique({
      where: { id: locationId },
    });

    if (!currentLocation) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 },
      );
    }

    const json = await request.json();

    const updatedLocation = await prisma.location.update({
      where: { id: locationId },
      data: {
        name: json.name,
        state: json.state,
      },
    });

    // Create history record
    await prisma.history.create({
      data: {
        tableName: "Location",
        recordId: locationId.toString(),
        action: "UPDATE",
        oldValues: JSON.stringify(currentLocation),
        newValues: JSON.stringify(updatedLocation),
        userId: userId,
      },
    });

    return NextResponse.json(updatedLocation);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error updating location",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

// DELETE location
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const userRole = session.user.role as UserRole;
  const userId = session.user.id;

  // Only Admins can delete locations
  if (userRole !== "Admin") {
    return NextResponse.json({ message: "Not authorized" }, { status: 403 });
  }

  try {
    const locationId = parseInt(id);

    // Check if there are employees at this location
    const employeeCount = await prisma.employee.count({
      where: { locationId: locationId },
    });

    if (employeeCount > 0) {
      return NextResponse.json(
        { error: "Cannot delete location with active employees" },
        { status: 400 },
      );
    }

    // Get current location data for history
    const currentLocation = await prisma.location.findUnique({
      where: { id: locationId },
    });

    if (!currentLocation) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 },
      );
    }

    // Delete location
    await prisma.$transaction([
      // Create history record
      prisma.history.create({
        data: {
          tableName: "Location",
          recordId: locationId.toString(),
          action: "DELETE",
          oldValues: JSON.stringify(currentLocation),
          userId: userId,
        },
      }),
      // Delete the location
      prisma.location.delete({
        where: { id: locationId },
      }),
    ]);

    return NextResponse.json({ message: "Location deleted successfully" });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error deleting location",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
