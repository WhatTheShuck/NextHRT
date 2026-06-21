import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/api-auth";
import { emailTemplateService } from "@/lib/services/emailTemplateService";

// GET a single template by its stable key (Admin only).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const session = await getAuth(request);

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  if (session.user.role !== "Admin") {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

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
  const session = await getAuth(request);

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  if (session.user.role !== "Admin") {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

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
      session.user.id,
    );
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "TEMPLATE_NOT_FOUND") {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 },
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
