import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { emailTemplateService } from "@/lib/services/emailTemplateService";

// GET past versions of a template, newest first. Each entry is the copy as it
// stood before that edit, which is what restoring it puts back.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const guard = await requireAdmin(request);
  if ("response" in guard) return guard.response;

  const { key } = await params;

  try {
    const versions = await emailTemplateService.getHistory(
      decodeURIComponent(key),
    );
    return NextResponse.json(versions);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error fetching template history",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
