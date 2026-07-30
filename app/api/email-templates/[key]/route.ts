import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { emailTemplateService } from "@/lib/services/emailTemplateService";

// GET a single template by its stable key (Admin only).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const guard = await requireAdmin(request);
  if ("response" in guard) return guard.response;

  const { key } = await params;

  try {
    const template = await emailTemplateService.getTemplateByKey(
      decodeURIComponent(key),
    );
    return NextResponse.json(template);
  } catch (error) {
    if (error instanceof Error && error.message === "TEMPLATE_NOT_FOUND") {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 },
      );
    }
    return NextResponse.json(
      {
        error: "Error fetching template",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

// PUT update a template's subject/body/name/isActive (Admin only).
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const guard = await requireAdmin(request);
  if ("response" in guard) return guard.response;

  const { key } = await params;

  try {
    const json = await request.json();
    const updated = await emailTemplateService.updateTemplate(
      decodeURIComponent(key),
      {
        name: json.name,
        subject: json.subject,
        body: json.body,
        isActive: json.isActive,
      },
      guard.session.user.id,
    );
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "TEMPLATE_NOT_FOUND") {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 },
      );
    }
    if (error instanceof Error && error.message === "LAYOUT_MISSING_CONTENT") {
      return NextResponse.json(
        {
          error:
            "The shared layout must contain {content} — that is where each email's copy goes.",
        },
        { status: 400 },
      );
    }
    return NextResponse.json(
      {
        error: "Error updating template",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
