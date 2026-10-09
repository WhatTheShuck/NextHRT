import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/api-admin";
import { delegatedAccessService } from "@/lib/services/delegatedAccessService";

const patchSchema = z.object({ level: z.enum(["Act", "View"]) });

async function grantId(params: Promise<{ id: string }>) {
  const id = Number((await params).id);
  return Number.isInteger(id) ? id : null;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(request);
  if ("response" in guard) return guard.response;
  const id = await grantId(params);
  if (id === null) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const updated = await delegatedAccessService.setLevel(id, parsed.data.level, guard.session.user.id);
  if (!updated) return NextResponse.json({ error: "Grant not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(request);
  if ("response" in guard) return guard.response;
  const id = await grantId(params);
  if (id === null) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const removed = await delegatedAccessService.remove(id, guard.session.user.id);
  if (!removed) return NextResponse.json({ error: "Grant not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
