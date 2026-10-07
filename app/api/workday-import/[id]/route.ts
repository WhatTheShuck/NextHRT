import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { workdayImportService } from "@/lib/services/workdayImportService";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const guard = await requireAdmin(request);
  if ("response" in guard) return guard.response;
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  try {
    return NextResponse.json(await workdayImportService.getImportView(id));
  } catch (error) {
    if (error instanceof Error && error.message === "IMPORT_NOT_FOUND") {
      return NextResponse.json({ error: "Import not found" }, { status: 404 });
    }
    console.error("Workday import view failed:", error);
    return NextResponse.json({ error: "Failed to load the import" }, { status: 500 });
  }
}

// Discard an open session (kept as a record).
export async function DELETE(request: NextRequest, { params }: Params) {
  const guard = await requireAdmin(request);
  if ("response" in guard) return guard.response;
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  await workdayImportService.discard(id);
  return NextResponse.json({ ok: true });
}
