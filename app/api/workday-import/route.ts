import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { workdayImportService } from "@/lib/services/workdayImportService";
import { WorkdayParseError } from "@/lib/workday/parseOrgChart";

const MAX_BYTES = 5 * 1024 * 1024;

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if ("response" in guard) return guard.response;
  return NextResponse.json(await workdayImportService.listImports());
}

// Upload a Workday org-chart export; supersedes any open session.
export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if ("response" in guard) return guard.response;

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Attach the Workday export as 'file'" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "That file is too large for an org chart export (5 MB max)" }, { status: 400 });
  }

  try {
    const created = await workdayImportService.createImport(
      new Uint8Array(await file.arrayBuffer()),
      file.name,
      guard.session.user.id,
    );
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof WorkdayParseError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Workday import upload failed:", error);
    return NextResponse.json({ error: "Failed to read the export" }, { status: 500 });
  }
}
