import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { UserRole } from "@/generated/prisma_client";
import { locationService } from "@/lib/services/locationService";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get("activeOnly") === "true";

  try {
    const locations = await locationService.getLocations({ activeOnly });
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
}

// POST new location
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const userRole = session.user.role as UserRole;

  // Only Admins can create locations
  if (userRole !== "Admin") {
    return NextResponse.json({ message: "Not authorized" }, { status: 403 });
  }

  try {
    const json = await request.json();
    const location = await locationService.createLocation(
      json,
      session.user.id,
    );
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
}
