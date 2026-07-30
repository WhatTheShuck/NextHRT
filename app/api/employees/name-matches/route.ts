import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/api-auth";
import { findNameMatches } from "@/lib/services/employeeDuplicateService";

/**
 * GET /api/employees/name-matches?firstName=&lastName=
 *
 * Exact-but-case-insensitive legal-name lookup, used by two callers with very
 * different trust levels:
 *
 * - The **Admin** approval panel needs the full match records to reconcile a
 *   rehire, so Admins get the whole `DuplicateMatch` projection.
 * - The **onboarding form** is submittable by any authenticated user
 *   (`POST /api/onboarding` has no role check), so non-Admins get a count and a
 *   single "is one of them departed" bit — no names, no dates, no departments,
 *   and no echo of the submitted name.
 *
 * Disclosure trade-off, recorded deliberately: the count-only response is still
 * an existence oracle. Any authenticated user can probe whether *some* record
 * matches a name they type, including departed staff they cannot otherwise see
 * (`getEmployees` scopes non-admins by `employee.viewAll` / `viewDepartment`).
 * Every authenticated user here is a staff member and the answer is one bit about
 * a name they already had to know to ask, so this is accepted rather than
 * mitigated.
 */
export async function GET(request: NextRequest) {
  const session = await getAuth(request);

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const firstName = (searchParams.get("firstName") ?? "").trim();
  const lastName = (searchParams.get("lastName") ?? "").trim();

  if (!firstName || !lastName) {
    return NextResponse.json(
      { error: "firstName and lastName are both required" },
      { status: 400 },
    );
  }

  try {
    const matches = await findNameMatches(firstName, lastName);

    if (session.user.role === "Admin") {
      return NextResponse.json({
        count: matches.length,
        hasDepartedMatch: matches.some((match) => !match.isActive),
        matches,
      });
    }

    return NextResponse.json({
      count: matches.length,
      hasDepartedMatch: matches.some((match) => !match.isActive),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error checking for name matches",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
