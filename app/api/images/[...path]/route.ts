import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import prisma from "@/lib/prisma";
import { UserRole } from "@/generated/prisma_client";
import { hasAccessToEmployee } from "@/lib/apiRBAC";

// GET serve image files with RBAC
export const GET = auth(async function GET(
  request,
  props: { params: Promise<{ path: string[] }> },
) {
  if (!request.auth) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const params = await props.params;
  const userId = request.auth.user?.id;
  const userRole = request.auth.user?.role as UserRole;

  try {
    // Reconstruct the file path from the dynamic route segments
    const filePath = params.path.join("/");

    // Security: Prevent directory traversal attacks
    if (filePath.includes("..") || filePath.includes("\\")) {
      return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
    }

    // Extract the filename from the path to search in database
    const fileName = path.basename(filePath);

    // Check if this is a ticket image (based on folder structure)
    if (filePath.startsWith("tickets/")) {
      // Find the ticket record that owns this image
      const ticketRecord = await prisma.ticketRecords.findFirst({
        where: {
          imagePath: filePath,
        },
        include: {
          ticketHolder: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              departmentId: true,
            },
          },
        },
      });

      if (!ticketRecord) {
        return NextResponse.json({ error: "Image not found" }, { status: 404 });
      }

      // Check if user has access to this employee's records
      const hasAccess = await hasAccessToEmployee(
        userId,
        ticketRecord.ticketHolder.id,
        userRole,
      );

      if (!hasAccess) {
        return NextResponse.json(
          { error: "Not authorised to view this image" },
          { status: 403 },
        );
      }
    }
    // Add similar checks for training images if needed
    else if (filePath.startsWith("training/")) {
      // Find the training record that owns this image
      const trainingRecord = await prisma.trainingRecords.findFirst({
        where: {
          imagePath: filePath,
        },
        include: {
          personTrained: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              departmentId: true,
            },
          },
        },
      });

      if (!trainingRecord) {
        return NextResponse.json({ error: "Image not found" }, { status: 404 });
      }

      // Check if user has access to this employee's records
      const hasAccess = await hasAccessToEmployee(
        userId,
        trainingRecord.personTrained.id,
        userRole,
      );

      if (!hasAccess) {
        return NextResponse.json(
          { error: "Not authorised to view this image" },
          { status: 403 },
        );
      }
    } else {
      // Unknown image type - deny access
      return NextResponse.json(
        { error: "Unauthorised image access" },
        { status: 403 },
      );
    }

    // Construct full file path
    const fullPath = path.join(process.cwd(), "uploads", filePath);

    // Check if file exists
    if (!existsSync(fullPath)) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Read file
    const fileBuffer = await readFile(fullPath);

    // Determine content type based on file extension
    const ext = path.extname(filePath).toLowerCase();
    let contentType = "application/octet-stream";

    switch (ext) {
      case ".jpg":
      case ".jpeg":
        contentType = "image/jpeg";
        break;
      case ".png":
        contentType = "image/png";
        break;
      case ".webp":
        contentType = "image/webp";
        break;
      case ".pdf":
        contentType = "application/pdf";
        break;
    }

    // Return file with appropriate headers
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": fileBuffer.length.toString(),
        "Cache-Control": "private, max-age=3600", // Cache for 1 hour, but mark as private
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error serving file",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
});
