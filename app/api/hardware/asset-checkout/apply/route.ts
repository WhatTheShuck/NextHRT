import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/api-auth";
import {
  hardwareService,
  ApplyCategoryAction,
} from "@/lib/services/hardwareService";

// POST /api/hardware/asset-checkout/apply
// Body: { actions: ApplyCategoryAction[] }
// Create/link hardware catalogue items from the suggestions an admin
// confirmed. Each action is applied independently; per-action failures come
// back in the response `errors` rather than failing the whole batch. Admin only.
export async function POST(request: NextRequest) {
  const session = await getAuth(request);

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  if (session.user.role !== "Admin") {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  let actions: ApplyCategoryAction[];
  try {
    const body = await request.json();
    actions = body?.actions;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(actions) || actions.length === 0) {
    return NextResponse.json(
      { error: "actions must be a non-empty array" },
      { status: 400 },
    );
  }

  try {
    const result = await hardwareService.applyAssetCheckoutSuggestions(
      actions,
      session.user.id,
    );
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to apply AssetCheckout suggestions",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
