import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { emailTemplateService } from "@/lib/services/emailTemplateService";

// POST put a template back to the copy captured by one History row. Recorded as
// a fresh UPDATE, so restoring is itself undoable.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ key: string; id: string }> },
) {
  const guard = await requireAdmin(request);
  if ("response" in guard) return guard.response;

  const { key, id } = await params;
  const historyId = Number(id);
  if (!Number.isInteger(historyId)) {
    return NextResponse.json({ error: "Invalid version id" }, { status: 400 });
  }

  try {
    const restored = await emailTemplateService.restoreVersion(
      decodeURIComponent(key),
      historyId,
      guard.session.user.id,
    );
    return NextResponse.json(restored);
  } catch (error) {
    if (error instanceof Error && error.message === "VERSION_NOT_FOUND") {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }
    if (error instanceof Error && error.message === "TEMPLATE_NOT_FOUND") {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    return NextResponse.json(
      {
        error: "Error restoring version",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
