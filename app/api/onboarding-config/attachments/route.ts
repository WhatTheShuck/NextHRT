import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/api-auth";
import { onboardingConfigService } from "@/lib/services/onboardingConfigService";

// POST upload compliance attachment(s) for a slot (Admin only).
// Multipart form data: `slot` ("employmentForms" | "policeCheck") + one or more
// `file` entries. The employment-forms slot appends; police check replaces.
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
    const files = formData
      .getAll("file")
      .filter((f): f is File => f instanceof File && f.size > 0);

    if (typeof slot !== "string") {
      return NextResponse.json({ error: "Missing slot" }, { status: 400 });
    }
    if (files.length === 0) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    const attachments = await onboardingConfigService.addAttachments(
      slot,
      files,
      session.user.id,
    );
    return NextResponse.json({ slot, attachments });
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "INVALID_SLOT":
          return NextResponse.json(
            { error: "Invalid attachment slot" },
            { status: 400 },
          );
        case "NO_FILES":
          return NextResponse.json({ error: "Missing file" }, { status: 400 });
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
        case "EMAIL_SIZE_EXCEEDED":
          return NextResponse.json(
            {
              error:
                "These files would make the onboarding email too large to send (the 25MB limit applies to employment forms and the police-check form combined). Remove or shrink a file and try again.",
            },
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
