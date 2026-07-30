import { NextResponse, type NextRequest } from "next/server";
import { getAuth } from "@/lib/api-auth";

type Session = NonNullable<Awaited<ReturnType<typeof getAuth>>>;

/**
 * Resolve an Admin session, or the response to return instead. Collapses the
 * 401/403 pair that every admin-only route repeats:
 *
 *   const guard = await requireAdmin(request);
 *   if ("response" in guard) return guard.response;
 *   // guard.session is an Admin
 */
export async function requireAdmin(
  request: NextRequest,
): Promise<{ session: Session } | { response: NextResponse }> {
  const session = await getAuth(request);

  if (!session) {
    return {
      response: NextResponse.json(
        { message: "Not authenticated" },
        { status: 401 },
      ),
    };
  }

  if (session.user.role !== "Admin") {
    return {
      response: NextResponse.json(
        { message: "Not authorised" },
        { status: 403 },
      ),
    };
  }

  return { session };
}
