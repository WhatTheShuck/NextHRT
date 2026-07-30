// app/api/onboarding/[id]/approve/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockGetSession, mockApproveRequest, mockEnqueueAll } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockApproveRequest: vi.fn(),
  mockEnqueueAll: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: mockGetSession } },
}));
vi.mock("@/lib/services/onboardingService", () => ({
  onboardingService: { approveRequest: mockApproveRequest },
}));
vi.mock("@/lib/services/onboardingFanOutService", () => ({
  onboardingFanOutService: { enqueueAll: mockEnqueueAll },
}));

import { POST } from "@/app/api/onboarding/[id]/approve/route";

const adminSession = { user: { id: "admin-1", role: "Admin" } };
const userSession = { user: { id: "user-1", role: "User" } };

/** `body` is sent verbatim as the raw request body when it is a string. */
function makeRequest(body?: unknown): NextRequest {
  return new NextRequest("http://localhost/api/onboarding/10/approve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body:
      body === undefined
        ? undefined
        : typeof body === "string"
          ? body
          : JSON.stringify(body),
  });
}

function makeParams(id = "10") {
  return { params: Promise.resolve({ id }) };
}

/** The (edits, decision) pair the route passed to the service. */
function approvalArgs() {
  const call = mockApproveRequest.mock.calls[0];
  return { edits: call[2], decision: call[3] };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockResolvedValue(adminSession);
  mockApproveRequest.mockResolvedValue({
    request: { id: 10 },
    employee: { id: 77 },
  });
  mockEnqueueAll.mockResolvedValue(undefined);
});

describe("POST /api/onboarding/[id]/approve — auth and id", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await POST(makeRequest(), makeParams());

    expect(res.status).toBe(401);
    expect(mockApproveRequest).not.toHaveBeenCalled();
  });

  it("returns 403 for a non-Admin", async () => {
    mockGetSession.mockResolvedValue(userSession);

    const res = await POST(makeRequest(), makeParams());

    expect(res.status).toBe(403);
    expect(mockApproveRequest).not.toHaveBeenCalled();
  });

  it("returns 400 for a non-integer route id instead of 500-ing in Prisma", async () => {
    const res = await POST(makeRequest(), makeParams("not-a-number"));

    expect(res.status).toBe(400);
    expect(mockApproveRequest).not.toHaveBeenCalled();
  });
});

describe("POST /api/onboarding/[id]/approve — body shapes", () => {
  it("still treats a bare edits object as edits + create mode (old client)", async () => {
    const res = await POST(
      makeRequest({ legalLastName: "Smith", title: "Engineer" }),
      makeParams(),
    );

    expect(res.status).toBe(200);
    const { edits, decision } = approvalArgs();
    expect(edits).toEqual({ legalLastName: "Smith", title: "Engineer" });
    expect(decision).toBeUndefined(); // service defaults to { mode: "create" }
  });

  it("parses the new { edits, decision } shape", async () => {
    await POST(
      makeRequest({
        edits: { title: "Engineer" },
        decision: { mode: "rehire", employeeId: 77 },
      }),
      makeParams(),
    );

    const { edits, decision } = approvalArgs();
    expect(edits).toEqual({ title: "Engineer" });
    expect(decision).toMatchObject({ mode: "rehire", employeeId: 77 });
  });

  it("accepts a decision with no edits", async () => {
    await POST(
      makeRequest({ decision: { mode: "create", confirmDuplicate: true } }),
      makeParams(),
    );

    const { edits, decision } = approvalArgs();
    expect(edits).toBeUndefined();
    expect(decision).toEqual({ mode: "create", confirmDuplicate: true });
  });

  it("treats an empty body as approve-as-submitted", async () => {
    const res = await POST(makeRequest(), makeParams());

    expect(res.status).toBe(200);
    expect(approvalArgs().edits).toBeUndefined();
  });

  it("does not 500 on a valid-JSON non-object body", async () => {
    // `"edits" in "hello"` is a TypeError; the json() try/catch would not catch it.
    for (const raw of ['"hello"', "5", "true", "null", "[1,2]"]) {
      vi.clearAllMocks();
      mockGetSession.mockResolvedValue(adminSession);
      mockApproveRequest.mockResolvedValue({
        request: { id: 10 },
        employee: { id: 77 },
      });

      const res = await POST(makeRequest(raw), makeParams());

      expect(res.status).toBe(200);
      expect(approvalArgs().edits).toBeUndefined();
    }
  });

  it("does not 500 on malformed JSON", async () => {
    const res = await POST(makeRequest("{not json"), makeParams());

    expect(res.status).toBe(200);
  });
});

describe("POST /api/onboarding/[id]/approve — decision validation", () => {
  it("rejects an unknown mode with 422", async () => {
    const res = await POST(
      makeRequest({ decision: { mode: "rehir", employeeId: 77 } }),
      makeParams(),
    );

    expect(res.status).toBe(422);
    expect(mockApproveRequest).not.toHaveBeenCalled();
  });

  it("rejects a non-integer rehire employeeId with 422", async () => {
    for (const employeeId of ["77", 1.5, null, undefined, {}]) {
      vi.clearAllMocks();
      mockGetSession.mockResolvedValue(adminSession);

      const res = await POST(
        makeRequest({ decision: { mode: "rehire", employeeId } }),
        makeParams(),
      );

      expect(res.status).toBe(422);
      expect(mockApproveRequest).not.toHaveBeenCalled();
    }
  });

  it("rejects a decision that is not an object with a mode", async () => {
    for (const decision of ["rehire", 5, [], {}]) {
      vi.clearAllMocks();
      mockGetSession.mockResolvedValue(adminSession);

      const res = await POST(makeRequest({ decision }), makeParams());

      expect(res.status).toBe(422);
    }
  });

  it("coerces a junk confirmDuplicate to false so it fails closed", async () => {
    await POST(
      makeRequest({ decision: { mode: "create", confirmDuplicate: "yes" } }),
      makeParams(),
    );

    expect(approvalArgs().decision).toEqual({
      mode: "create",
      confirmDuplicate: false,
    });
  });

  it("passes the rehire reconciliation fields through", async () => {
    await POST(
      makeRequest({
        decision: {
          mode: "rehire",
          employeeId: 77,
          priorFinishDate: "2020-06-30T00:00:00.000Z",
          legalFirstName: "Jayne",
          optionalFields: { preferredFirstName: null, jobFamilyId: 4 },
        },
      }),
      makeParams(),
    );

    expect(approvalArgs().decision).toEqual({
      mode: "rehire",
      employeeId: 77,
      priorFinishDate: "2020-06-30T00:00:00.000Z",
      legalFirstName: "Jayne",
      legalLastName: undefined,
      optionalFields: { preferredFirstName: null, jobFamilyId: 4 },
    });
  });
});

describe("POST /api/onboarding/[id]/approve — error mapping", () => {
  const cases: Array<[string, number]> = [
    ["ONBOARDING_REQUEST_NOT_FOUND", 404],
    ["ONBOARDING_REQUEST_NOT_PENDING", 409],
    ["ONBOARDING_HAS_PENDING_ORG_REQUESTS", 409],
    ["ONBOARDING_MISSING_DEPT_OR_LOCATION", 422],
    ["ACTIVE_EMPLOYEE", 409],
    ["EMPLOYEE_NOT_FOUND", 422],
    ["MISSING_FINISH_DATE", 422],
    ["INVALID_REHIRE_DATE", 422],
    ["INVALID_APPROVAL_DECISION", 422],
  ];

  for (const [code, status] of cases) {
    it(`maps ${code} to ${status}`, async () => {
      mockApproveRequest.mockRejectedValue(new Error(code));

      const res = await POST(makeRequest(), makeParams());

      expect(res.status).toBe(status);
    });
  }

  it("names the rehire target on EMPLOYEE_NOT_FOUND, since 404 would be ambiguous", async () => {
    mockApproveRequest.mockRejectedValue(new Error("EMPLOYEE_NOT_FOUND"));

    const res = await POST(makeRequest(), makeParams());
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.error).toMatch(/rehire/i);
  });

  it("maps the plain-object DUPLICATE_EMPLOYEE throw to 409 with its matches", async () => {
    mockApproveRequest.mockRejectedValue({
      code: "DUPLICATE_EMPLOYEE",
      matches: [{ id: 77, legalFirstName: "Jane" }],
      suggestions: { rehire: true, duplicate: true },
    });

    const res = await POST(makeRequest(), makeParams());
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.code).toBe("DUPLICATE_EMPLOYEE");
    expect(body.matches).toHaveLength(1);
    expect(body.suggestions).toEqual({ rehire: true, duplicate: true });
  });

  it("returns 500 for an unrecognised failure", async () => {
    mockApproveRequest.mockRejectedValue(new Error("BOOM"));

    const res = await POST(makeRequest(), makeParams());

    expect(res.status).toBe(500);
  });
});

describe("POST /api/onboarding/[id]/approve — fan-out", () => {
  it("fires the fan-out with the returned request and employee", async () => {
    await POST(makeRequest(), makeParams());

    expect(mockEnqueueAll).toHaveBeenCalledWith({ id: 10 }, { id: 77 });
  });

  it("does not fail the response when the fan-out rejects", async () => {
    mockEnqueueAll.mockRejectedValue(new Error("mail down"));

    const res = await POST(makeRequest(), makeParams());

    expect(res.status).toBe(200);
  });
});
