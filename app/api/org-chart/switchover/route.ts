import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/api-admin";
import { switchoverService } from "@/lib/services/switchoverService";

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if ("response" in guard) return guard.response;
  try {
    return NextResponse.json(await switchoverService.getReport());
  } catch (error) {
    console.error("Switch-over report failed:", error);
    return NextResponse.json({ error: "Failed to build the readiness report" }, { status: 500 });
  }
}

const bodySchema = z.object({ keys: z.array(z.string().regex(/^\d+:\d+:\d+$/)).min(1) });

// Create the ticked delegated-access grants that carry today's department access over.
export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if ("response" in guard) return guard.response;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  try {
    return NextResponse.json(await switchoverService.createGrants(parsed.data.keys, guard.session.user.id));
  } catch (error) {
    console.error("Switch-over grant creation failed:", error);
    return NextResponse.json({ error: "Failed to create the grants" }, { status: 500 });
  }
}
