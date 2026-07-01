import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/api-auth";
import { hardwareService } from "@/lib/services/hardwareService";

export async function GET(request: NextRequest) {
  const session = await getAuth(request);

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get("activeOnly") === "true";

  try {
    const items = await hardwareService.getHardwareItems({ activeOnly });
    return NextResponse.json(items);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error fetching hardware items",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

// POST new hardware item (Admin only)
export async function POST(request: NextRequest) {
  const session = await getAuth(request);

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  if (session.user.role !== "Admin") {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  try {
    const json = await request.json();
    const item = await hardwareService.createHardwareItem(
      json,
      session.user.id,
    );
    return NextResponse.json(item);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "DUPLICATE_HARDWARE_ITEM":
          return NextResponse.json(
            { error: "A hardware item with this name already exists" },
            { status: 409 },
          );
      }
    }
    return NextResponse.json(
      {
        error: "Error creating hardware item",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
