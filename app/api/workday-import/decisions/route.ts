import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { ReplayMismatchError, workdayImportService } from "@/lib/services/workdayImportService";
import { decisionBundleSchema } from "@/lib/workday/decisionBundle";

// Download every review decision (links, ignore rules, applies, grants) as a JSON bundle.
export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if ("response" in guard) return guard.response;

  const bundle = await workdayImportService.exportDecisions();
  const stamp = bundle.exportedAt.slice(0, 16).replace(/[:T]/g, "-");
  return new NextResponse(JSON.stringify(bundle, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="workday-decisions-${stamp}.json"`,
    },
  });
}

// Replay a bundle exported from another copy of this HRT (e.g. a reviewed prod snapshot).
export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if ("response" in guard) return guard.response;

  const parsed = decisionBundleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "That isn't a Workday decisions export from HRT." }, { status: 400 });
  }

  try {
    return NextResponse.json(await workdayImportService.replayDecisions(parsed.data, guard.session.user.id));
  } catch (error) {
    if (error instanceof ReplayMismatchError) {
      return NextResponse.json(
        {
          error: `Nothing was changed: this HRT isn't a copy of the one the decisions came from (${error.mismatches.length} employee or department id${error.mismatches.length === 1 ? "" : "s"} don't match).`,
          mismatches: error.mismatches.slice(0, 20),
        },
        { status: 409 },
      );
    }
    console.error("Workday decisions replay failed:", error);
    return NextResponse.json({ error: "Replay failed part-way. Check the import page and history." }, { status: 500 });
  }
}
