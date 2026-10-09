import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/api-admin";
import { ApplyCycleError, workdayImportService } from "@/lib/services/workdayImportService";

const bodySchema = z.object({
  ticked: z.array(z.string()),
  crossed: z.array(z.string()).default([]),
  choices: z.record(z.string(), z.number().int()).optional(),
  names: z.record(z.string(), z.object({ first: z.string().max(100), last: z.string().max(100) })).optional(),
  departments: z.record(z.string(), z.number().int()).optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(request);
  if ("response" in guard) return guard.response;
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  try {
    return NextResponse.json(await workdayImportService.apply(id, parsed.data, guard.session.user.id));
  } catch (error) {
    if (error instanceof ApplyCycleError) {
      const loops = error.people.map((loop) => loop.join(" → ")).join("; ");
      return NextResponse.json(
        { error: `Nothing was applied: these changes would create a reporting loop (${loops}).` },
        { status: 409 },
      );
    }
    if (error instanceof Error) {
      if (error.message === "IMPORT_NOT_FOUND") return NextResponse.json({ error: "Import not found" }, { status: 404 });
      if (error.message === "IMPORT_NOT_OPEN") {
        return NextResponse.json({ error: "This import has been superseded or discarded" }, { status: 409 });
      }
    }
    console.error("Workday import apply failed:", error);
    return NextResponse.json({ error: "Failed to apply changes" }, { status: 500 });
  }
}
