import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/api-admin";
import { getAuthorityMode, setAuthorityMode } from "@/lib/services/authorityService";

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if ("response" in guard) return guard.response;
  return NextResponse.json({ mode: await getAuthorityMode() });
}

const bodySchema = z.object({ mode: z.enum(["department", "lineManager"]) });

// Switch who has authority over whom: department managers, or reporting lines plus delegated
// access (docs/workday-org-import-spec.md §9). Takes effect on everyone's next request.
export async function PUT(request: NextRequest) {
  const guard = await requireAdmin(request);
  if ("response" in guard) return guard.response;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  await setAuthorityMode(parsed.data.mode, guard.session.user.id);
  return NextResponse.json({ mode: parsed.data.mode });
}
