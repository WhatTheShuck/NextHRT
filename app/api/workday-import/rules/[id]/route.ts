import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { workdayImportService } from "@/lib/services/workdayImportService";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(request);
  if ("response" in guard) return guard.response;
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  try {
    await workdayImportService.removeIgnoreRule(id);
  } catch {
    return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
