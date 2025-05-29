import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

// GET serve image files
export const GET = auth(async function GET(
  request,
  props: { params: Promise<{ path: string[] }> },
) {
  if (!request.auth) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const params = await props.params;
  try {
    // Reconstruct the file path from the dynamic route segments
    const filePath = params.path.join("/");

    // Security: Prevent directory traversal attacks
    if (filePath.includes("..") || filePath.includes("\\")) {
      return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
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
        "Cache-Control": "public, max-age=31536000, immutable", // Cache for 1 year
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
