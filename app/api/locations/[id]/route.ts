import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { UserRole } from "@/generated/prisma_client";

// GET single location
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
    const location = await prisma.location.findUnique({
      where: { id },
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
            isActive: true,
          },
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
});

// PUT update location
export const PUT = auth(async function PUT(
  request,
  props: { params: Promise<{ id: string }> },
) {
  if (!request.auth) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const params = await props.params;
  const userRole = request.auth.user?.role as UserRole;
  const userId = request.auth.user?.id;

  // Only Admins can update locations
  if (userRole !== "Admin") {
    return NextResponse.json({ message: "Not authorized" }, { status: 403 });
  }

  try {
    const id = parseInt(params.id);

    // Get current location data for history
    const currentLocation = await prisma.location.findUnique({
      where: { id },
    });

    if (!currentLocation) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 },
      );
    }

    const json = await request.json();

    const updatedLocation = await prisma.location.update({
      where: { id },
      data: {
        name: json.name,
        state: json.state,
      },
    });

    // Create history record
    await prisma.history.create({
      data: {
        tableName: "Location",
        recordId: id.toString(),
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
});

// DELETE location
export const DELETE = auth(async function DELETE(
  request,
  props: { params: Promise<{ id: string }> },
) {
  if (!request.auth) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const params = await props.params;
  const userRole = request.auth.user?.role as UserRole;
  const userId = request.auth.user?.id;

  // Only Admins can delete locations
  if (userRole !== "Admin") {
    return NextResponse.json({ message: "Not authorized" }, { status: 403 });
  }

  try {
    const id = parseInt(params.id);

    // Check if there are employees at this location
    const employeeCount = await prisma.employee.count({
      where: { locationId: id },
    });

    if (employeeCount > 0) {
      return NextResponse.json(
        { error: "Cannot delete location with active employees" },
        { status: 400 },
      );
    }

    // Get current location data for history
    const currentLocation = await prisma.location.findUnique({
      where: { id },
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
          recordId: id,
          action: "DELETE",
          oldValues: JSON.stringify(currentLocation),
          userId: userId,
        },
      }),
      // Delete the location
      prisma.location.delete({
        where: { id },
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
});
