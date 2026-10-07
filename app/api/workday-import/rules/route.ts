import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/api-admin";
import { workdayImportService } from "@/lib/services/workdayImportService";

const bodySchema = z.object({
  subjectKey: z.string(),
  field: z.string(),
  value: z.string(),
  note: z.string().max(500).nullish(),
  workdayName: z.string().nullish(),
});

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if ("response" in guard) return guard.response;
  return NextResponse.json(await workdayImportService.listIgnoreRules());
}

// "Ignore forever" for one line.
export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if ("response" in guard) return guard.response;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  try {
    return NextResponse.json(await workdayImportService.addIgnoreRule(parsed.data, guard.session.user.id), { status: 201 });
  } catch (error) {
    if (error instanceof Error && (error.message === "INVALID_FIELD" || error.message === "INVALID_SUBJECT")) {
      return NextResponse.json({ error: "Invalid rule" }, { status: 400 });
    }
    throw error;
  }
}
