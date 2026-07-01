import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/api-auth";
import { emailTemplateService } from "@/lib/services/emailTemplateService";

// GET all onboarding email templates (Admin only — this is config surface).
export async function GET(request: NextRequest) {
  const session = await getAuth(request);

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  if (session.user.role !== "Admin") {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  try {
    const templates = await emailTemplateService.getTemplates();
    return NextResponse.json(templates);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error fetching email templates",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
