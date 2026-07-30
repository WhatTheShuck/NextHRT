import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/api-auth";
import {
  onboardingService,
  type ApprovalDecision,
  type OnboardingCoreHRData,
  type RehireOptionalFields,
} from "@/lib/services/onboardingService";
import { onboardingFanOutService } from "@/lib/services/onboardingFanOutService";

/**
 * Split the request body into `{ edits, decision }`.
 *
 * The body used to *be* the edits object, and the old client still sends it that
 * way, so both shapes have to work. Discriminating them is unambiguous:
 * `Partial<OnboardingCoreHRData>` contains neither an `edits` nor a `decision`
 * key, so the presence of either means the new shape.
 *
 * The `isObject` narrowing is load-bearing rather than defensive noise:
 * `request.json()` happily returns a string or a number for a body of `"hello"` or
 * `5`, and `"edits" in "hello"` is a TypeError → 500. The try/catch around
 * `request.json()` only catches malformed JSON, not valid-JSON-wrong-type.
 */
function splitBody(body: unknown): {
  edits?: Partial<OnboardingCoreHRData>;
  decision?: unknown;
} {
  const isObject =
    typeof body === "object" && body !== null && !Array.isArray(body);
  if (!isObject) return {};

  const record = body as Record<string, unknown>;
  const isNewShape = "edits" in record || "decision" in record;

  if (isNewShape) {
    return {
      edits: record.edits as Partial<OnboardingCoreHRData> | undefined,
      decision: record.decision,
    };
  }

  return { edits: record as Partial<OnboardingCoreHRData> };
}

/**
 * Validate the decision object. Zod on this route is still outstanding work; until
 * then this is hand-validated input reaching a transaction, so both fields are
 * checked explicitly — an unrecognised `mode` or a non-integer `employeeId` would
 * otherwise reach Prisma and surface as a 500.
 *
 * Returns the parsed decision, or an error message for a 422.
 */
function parseDecision(
  decision: unknown,
): { ok: true; decision?: ApprovalDecision } | { ok: false; error: string } {
  if (decision === undefined || decision === null) return { ok: true };

  if (
    typeof decision !== "object" ||
    Array.isArray(decision) ||
    !("mode" in decision)
  ) {
    return { ok: false, error: "decision must be an object with a mode" };
  }

  const record = decision as Record<string, unknown>;

  if (record.mode === "create") {
    return {
      ok: true,
      // `=== true` so a junk value fails closed into the duplicate guard.
      decision: { mode: "create", confirmDuplicate: record.confirmDuplicate === true },
    };
  }

  if (record.mode === "rehire") {
    if (!Number.isInteger(record.employeeId)) {
      return {
        ok: false,
        error: "decision.employeeId must be an integer employee id",
      };
    }
    return {
      ok: true,
      decision: {
        mode: "rehire",
        employeeId: record.employeeId as number,
        priorFinishDate: record.priorFinishDate as string | null | undefined,
        legalFirstName: record.legalFirstName as string | undefined,
        legalLastName: record.legalLastName as string | undefined,
        optionalFields: record.optionalFields as RehireOptionalFields | undefined,
      },
    };
  }

  return { ok: false, error: `Unknown approval mode: ${String(record.mode)}` };
}

// POST approve an onboarding request (Admin-only). In one transaction: applies the
// Admin's edits to the core HR fields, then either creates the Employee (no User)
// or reactivates a departed one as a rehire, and flips the request to Approved
// (the data-integrity gate, §6.3).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAuth(request);

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  if (session.user.role !== "Admin") {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  const { id } = await params;
  const requestId = parseInt(id);
  if (!Number.isInteger(requestId)) {
    return NextResponse.json(
      { error: "Invalid onboarding request id" },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = undefined; // empty body = approve as-submitted
  }

  const { edits, decision: rawDecision } = splitBody(body);
  const parsed = parseDecision(rawDecision);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 422 });
  }

  try {
    const result = await onboardingService.approveRequest(
      requestId,
      session.user.id,
      edits,
      parsed.decision,
    );

    // Enqueue all downstream jobs (Wave E / §7). Errors are logged per-section
    // but do NOT fail the response — the Employee is created regardless. A rehire
    // gets the identical new-starter fan-out, deliberately: the returning employee
    // still needs hardware, program access and forms.
    onboardingFanOutService.enqueueAll(result.request, result.employee).catch((err) => {
      console.error("[onboarding-fan-out] Unexpected error:", err);
    });

    return NextResponse.json(result);
  } catch (error) {
    // DUPLICATE_EMPLOYEE is a plain-object throw, not an Error, so it is matched
    // before the message switch below.
    if (
      typeof error === "object" &&
      error !== null &&
      (error as { code?: string }).code === "DUPLICATE_EMPLOYEE"
    ) {
      const duplicate = error as {
        matches: unknown[];
        suggestions: Record<string, boolean>;
      };
      return NextResponse.json(
        {
          error:
            "An existing employee record matches this name. Rehire that record, or confirm this is a different person.",
          code: "DUPLICATE_EMPLOYEE",
          matches: duplicate.matches,
          suggestions: duplicate.suggestions,
        },
        { status: 409 },
      );
    }

    if (error instanceof Error) {
      switch (error.message) {
        case "ONBOARDING_REQUEST_NOT_FOUND":
          return NextResponse.json(
            { error: "Onboarding request not found" },
            { status: 404 },
          );
        case "ONBOARDING_REQUEST_NOT_PENDING":
          return NextResponse.json(
            { error: "Only pending requests can be approved" },
            { status: 409 },
          );
        case "ONBOARDING_HAS_PENDING_ORG_REQUESTS":
          return NextResponse.json(
            { error: "Resolve all pending department/location requests before approving" },
            { status: 409 },
          );
        case "ONBOARDING_MISSING_DEPT_OR_LOCATION":
          return NextResponse.json(
            { error: "Department and location must be set before approving" },
            { status: 422 },
          );
        case "ACTIVE_EMPLOYEE":
          return NextResponse.json(
            {
              error:
                "That employee is already active — only a departed employee can be rehired",
            },
            { status: 409 },
          );
        // 422, not 404: a 404 here is ambiguous with the onboarding request itself
        // not being found, so the message has to name the rehire target.
        case "EMPLOYEE_NOT_FOUND":
          return NextResponse.json(
            { error: "The employee selected for rehire no longer exists" },
            { status: 422 },
          );
        case "MISSING_FINISH_DATE":
          return NextResponse.json(
            {
              error:
                "The prior record has no finish date — supply one to close the previous stint",
            },
            { status: 422 },
          );
        case "INVALID_REHIRE_DATE":
          return NextResponse.json(
            {
              error:
                "The start date must be a valid date after the prior stint's finish date",
            },
            { status: 422 },
          );
        case "INVALID_APPROVAL_DECISION":
          return NextResponse.json(
            { error: "Unrecognised approval decision" },
            { status: 422 },
          );
      }
    }
    return NextResponse.json(
      {
        error: "Error approving onboarding request",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
