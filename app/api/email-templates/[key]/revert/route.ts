import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { emailTemplateService } from "@/lib/services/emailTemplateService";

// POST restore a template to the copy it shipped with. Audited as a REVERT,
// which also re-enrols it in future default updates.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const guard = await requireAdmin(request);
  if ("response" in guard) return guard.response;

  const { key } = await params;

  try {
    const reverted = await emailTemplateService.revertToDefault(
      decodeURIComponent(key),
      guard.session.user.id,
    );
    return NextResponse.json(reverted);
  } catch (error) {
    if (error instanceof Error && error.message === "TEMPLATE_NOT_FOUND") {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    return NextResponse.json(
      {
        error: "Error reverting template",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
