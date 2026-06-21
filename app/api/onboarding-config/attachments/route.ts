import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/api-auth";
import { onboardingConfigService } from "@/lib/services/onboardingConfigService";

// POST upload (or replace) a compliance attachment for a slot (Admin only).
// Multipart form data: `slot` ("employmentForms" | "policeCheck") + `file`.
export async function POST(request: NextRequest) {
  const session = await getAuth(request);

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  if (session.user.role !== "Admin") {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const slot = formData.get("slot");
    const file = formData.get("file");

    if (typeof slot !== "string") {
      return NextResponse.json({ error: "Missing slot" }, { status: 400 });
    }
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    const result = await onboardingConfigService.setAttachment(
      slot,
      file,
      session.user.id,
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "INVALID_SLOT":
          return NextResponse.json(
            { error: "Invalid attachment slot" },
            { status: 400 },
          );
        case "INVALID_FILE_TYPE":
          return NextResponse.json(
            { error: "Invalid file type" },
            { status: 400 },
          );
        case "FILE_TOO_LARGE":
          return NextResponse.json(
            { error: "File too large" },
            { status: 400 },
          );
      }
    }
    return NextResponse.json(
      {
        error: "Error uploading attachment",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
