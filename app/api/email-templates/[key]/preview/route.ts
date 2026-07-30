import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { emailTemplateService } from "@/lib/services/emailTemplateService";

// POST render draft copy against sample data, exactly as a send would compose
// it — row fragments and the shared layout included. Rendered server-side so
// the preview can't drift from what recipients actually receive.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const guard = await requireAdmin(request);
  if ("response" in guard) return guard.response;

  const { key } = await params;

  try {
    const json = await request.json();
    if (typeof json.subject !== "string" || typeof json.body !== "string") {
      return NextResponse.json(
        { error: "subject and body are required" },
        { status: 400 },
      );
    }

    const preview = await emailTemplateService.renderPreview(
      decodeURIComponent(key),
      { subject: json.subject, body: json.body },
    );
    return NextResponse.json(preview);
  } catch (error) {
    if (error instanceof Error && error.message === "TEMPLATE_NOT_FOUND") {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    return NextResponse.json(
      {
        error: "Error rendering preview",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
