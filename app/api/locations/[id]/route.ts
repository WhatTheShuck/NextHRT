import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { UserRole } from "@/generated/prisma_client";
import { locationService } from "@/lib/services/locationService";

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
    const location = await locationService.getLocationById(locationId, {
      activeOnly,
    });
    return NextResponse.json(location);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "LOCATION_NOT_FOUND":
          return NextResponse.json(
            { error: "Location not found" },
            { status: 404 },
          );
      }
    }
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

  // Only Admins can update locations
  if (userRole !== "Admin") {
    return NextResponse.json({ message: "Not authorized" }, { status: 403 });
  }

  try {
    const locationId = parseInt(id);
    const json = await request.json();
    const updatedLocation = await locationService.updateLocation(
      locationId,
      json,
      session.user.id,
    );
    return NextResponse.json(updatedLocation);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "LOCATION_NOT_FOUND":
          return NextResponse.json(
            { error: "Location not found" },
            { status: 404 },
          );
      }
    }
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

  // Only Admins can delete locations
  if (userRole !== "Admin") {
    return NextResponse.json({ message: "Not authorized" }, { status: 403 });
  }

  try {
    const locationId = parseInt(id);
    const result = await locationService.deleteLocation(
      locationId,
      session.user.id,
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "LOCATION_NOT_FOUND":
          return NextResponse.json(
            { error: "Location not found" },
            { status: 404 },
          );
        case "LOCATION_HAS_EMPLOYEES":
          return NextResponse.json(
            { error: "Cannot delete location with active employees" },
            { status: 400 },
          );
      }
    }
    return NextResponse.json(
      {
        error: "Error deleting location",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
