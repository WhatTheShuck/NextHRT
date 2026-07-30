import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { emailTemplateService } from "@/lib/services/emailTemplateService";

// GET every email template with its editor metadata — group, kind, the tokens
// its send site supplies, and whether it has been edited or is still an
// unwritten placeholder (Admin only — this is config surface).
export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if ("response" in guard) return guard.response;

  try {
    const templates = await emailTemplateService.getTemplatesWithMeta();
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
