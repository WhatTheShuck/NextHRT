import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/api-auth";
import { hardwareService } from "@/lib/services/hardwareService";

// GET /api/hardware/asset-checkout/suggestions
// Poll AssetCheckout's requestable categories and reconcile them against the
// local hardware catalogue. Read-only — returns per-category suggestions for
// an admin to validate before applying. Only requestable categories are
// surfaced. Admin only.
export async function GET(request: NextRequest) {
  const session = await getAuth(request);

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  if (session.user.role !== "Admin") {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  try {
    const suggestions = await hardwareService.getAssetCheckoutSuggestions();
    return NextResponse.json({ suggestions });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch AssetCheckout categories",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 502 },
    );
  }
}
