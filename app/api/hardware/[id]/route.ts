import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/api-auth";
import { hardwareService } from "@/lib/services/hardwareService";

// GET single hardware item
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAuth(request);

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const item = await hardwareService.getHardwareItemById(parseInt(id));
    return NextResponse.json(item);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "HARDWARE_ITEM_NOT_FOUND":
          return NextResponse.json(
            { error: "Hardware item not found" },
            { status: 404 },
          );
      }
    }
    return NextResponse.json(
      {
        error: "Error fetching hardware item",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

// PUT update hardware item (Admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAuth(request);

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  if (session.user.role !== "Admin") {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const json = await request.json();
    const updated = await hardwareService.updateHardwareItem(
      parseInt(id),
      json,
      session.user.id,
    );
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "HARDWARE_ITEM_NOT_FOUND":
          return NextResponse.json(
            { error: "Hardware item not found" },
            { status: 404 },
          );
        case "DUPLICATE_HARDWARE_ITEM":
          return NextResponse.json(
            { error: "A hardware item with this name already exists" },
            { status: 409 },
          );
      }
    }
    return NextResponse.json(
      {
        error: "Error updating hardware item",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

// DELETE hardware item (Admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAuth(request);

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  if (session.user.role !== "Admin") {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const result = await hardwareService.deleteHardwareItem(
      parseInt(id),
      session.user.id,
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "HARDWARE_ITEM_NOT_FOUND":
          return NextResponse.json(
            { error: "Hardware item not found" },
            { status: 404 },
          );
      }
    }
    return NextResponse.json(
      {
        error: "Error deleting hardware item",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
