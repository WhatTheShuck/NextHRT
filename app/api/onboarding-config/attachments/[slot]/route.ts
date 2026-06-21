import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/api-auth";
import { onboardingConfigService } from "@/lib/services/onboardingConfigService";

// GET download the current attachment for a slot (Admin only).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slot: string }> },
) {
  const session = await getAuth(request);

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  if (session.user.role !== "Admin") {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  const { slot } = await params;

  try {
    const { buffer, contentType } =
      await onboardingConfigService.readAttachmentFile(slot);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "INVALID_SLOT":
          return NextResponse.json(
            { error: "Invalid attachment slot" },
            { status: 400 },
          );
        case "ATTACHMENT_NOT_FOUND":
          return NextResponse.json(
            { error: "No attachment uploaded for this slot" },
            { status: 404 },
          );
      }
    }
    return NextResponse.json(
      {
        error: "Error reading attachment",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

// DELETE remove the attachment for a slot (Admin only).
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slot: string }> },
) {
  const session = await getAuth(request);

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  if (session.user.role !== "Admin") {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  const { slot } = await params;

  try {
    const result = await onboardingConfigService.deleteAttachment(
      slot,
      session.user.id,
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_SLOT") {
      return NextResponse.json(
        { error: "Invalid attachment slot" },
        { status: 400 },
      );
    }
    return NextResponse.json(
      {
        error: "Error deleting attachment",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
