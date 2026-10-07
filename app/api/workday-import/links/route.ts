import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/api-admin";
import { workdayImportService } from "@/lib/services/workdayImportService";

const bodySchema = z.object({
  workdayNameKey: z.string().regex(/^[a-z]+$/),
  workdayName: z.string().min(1),
  employeeId: z.number().int().nullable(),
});

// Confirm who a Workday name is (employeeId null = "not in HRT"). Saved immediately (§6).
export async function PUT(request: NextRequest) {
  const guard = await requireAdmin(request);
  if ("response" in guard) return guard.response;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { workdayNameKey, workdayName, employeeId } = parsed.data;
  try {
    return NextResponse.json(
      await workdayImportService.setLink(workdayNameKey, workdayName, employeeId, guard.session.user.id),
    );
  } catch (error) {
    if (error instanceof Error && error.message === "EMPLOYEE_NOT_FOUND") {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }
    throw error;
  }
}

export async function DELETE(request: NextRequest) {
  const guard = await requireAdmin(request);
  if ("response" in guard) return guard.response;
  const key = new URL(request.url).searchParams.get("workdayNameKey");
  if (!key || !/^[a-z]+$/.test(key)) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  await workdayImportService.removeLink(key);
  return NextResponse.json({ ok: true });
}
