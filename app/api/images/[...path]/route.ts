import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { UserRole } from "@/generated/prisma_client";
import { imageService } from "@/lib/services/imageService";

// GET serve image files with RBAC
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const { path: pathSegments } = await params;
  const userId = session.user.id;
  const userRole = session.user.role as UserRole;

  try {
    const filePath = pathSegments.join("/");
    const { buffer, contentType } = await imageService.getImage(
      filePath,
      userId,
      userRole,
    );

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "INVALID_FILE_PATH":
          return NextResponse.json(
            { error: "Invalid file path" },
            { status: 400 },
          );
        case "IMAGE_NOT_FOUND":
          return NextResponse.json(
            { error: "Image not found" },
            { status: 404 },
          );
        case "NOT_AUTHORISED":
          return NextResponse.json(
            { error: "Not authorised to view this image" },
            { status: 403 },
          );
        case "UNAUTHORISED_IMAGE_ACCESS":
          return NextResponse.json(
            { error: "Unauthorised image access" },
            { status: 403 },
          );
        case "FILE_NOT_FOUND":
          return NextResponse.json(
            { error: "File not found" },
            { status: 404 },
          );
      }
    }
    return NextResponse.json(
      {
        error: "Error serving file",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
