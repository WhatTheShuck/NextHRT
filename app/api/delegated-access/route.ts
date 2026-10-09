import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/api-admin";
import { delegatedAccessService, GrantInputError } from "@/lib/services/delegatedAccessService";

const bodySchema = z.object({
  granteeEmployeeId: z.number().int(),
  scopeManagerEmployeeId: z.number().int(),
  departmentId: z.number().int().nullable(),
  jobFamilyId: z.number().int().nullable(),
  level: z.enum(["Act", "View"]),
});

// Every grant, plus what the add form picks from.
export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if ("response" in guard) return guard.response;
  const [grants, options] = await Promise.all([delegatedAccessService.list(), delegatedAccessService.options()]);
  return NextResponse.json({ grants, options });
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if ("response" in guard) return guard.response;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  try {
    return NextResponse.json(await delegatedAccessService.create(parsed.data, guard.session.user.id), { status: 201 });
  } catch (error) {
    if (error instanceof GrantInputError) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
}
