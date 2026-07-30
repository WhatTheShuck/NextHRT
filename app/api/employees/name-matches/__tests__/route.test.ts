// app/api/employees/name-matches/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockGetSession, mockFindNameMatches } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockFindNameMatches: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: mockGetSession } },
}));
vi.mock("@/lib/services/employeeDuplicateService", () => ({
  findNameMatches: mockFindNameMatches,
}));

import { GET } from "@/app/api/employees/name-matches/route";

const adminSession = { user: { id: "admin-1", role: "Admin" } };
const userSession = { user: { id: "user-1", role: "User" } };

const departedMatch = {
  id: 5,
  legalFirstName: "Jane",
  legalLastName: "Smith",
  preferredFirstName: "Janey",
  preferredLastName: "Smith",
  title: "Fitter",
  department: { id: 2, name: "Maintenance" },
  location: { id: 3, name: "Perth" },
  departmentId: 2,
  locationId: 3,
  status: "Permanent",
  usi: "OLD-USI",
  notes: "old notes",
  jobFamilyId: 4,
  isActive: false,
  startDate: new Date("2018-01-01T00:00:00.000Z"),
  finishDate: new Date("2020-06-30T00:00:00.000Z"),
};

const activeMatch = { ...departedMatch, id: 6, isActive: true, finishDate: null };

function makeRequest(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/employees/name-matches${query}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFindNameMatches.mockResolvedValue([]);
});

describe("GET /api/employees/name-matches", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await GET(makeRequest("?firstName=Jane&lastName=Smith"));

    expect(res.status).toBe(401);
    expect(mockFindNameMatches).not.toHaveBeenCalled();
  });

  it("returns 400 when either name is blank after trimming", async () => {
    mockGetSession.mockResolvedValue(adminSession);

    for (const query of [
      "?firstName=&lastName=Smith",
      "?firstName=Jane&lastName=",
      "?firstName=%20%20&lastName=Smith",
      "",
    ]) {
      const res = await GET(makeRequest(query));
      expect(res.status).toBe(400);
    }
    expect(mockFindNameMatches).not.toHaveBeenCalled();
  });

  it("gives an Admin the full match objects", async () => {
    mockGetSession.mockResolvedValue(adminSession);
    mockFindNameMatches.mockResolvedValue([departedMatch]);

    const res = await GET(makeRequest("?firstName=Jane&lastName=Smith"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.count).toBe(1);
    expect(body.hasDepartedMatch).toBe(true);
    expect(body.matches).toHaveLength(1);
    expect(body.matches[0]).toMatchObject({
      id: 5,
      legalFirstName: "Jane",
      title: "Fitter",
    });
    expect(body.matches[0].department).toEqual({ id: 2, name: "Maintenance" });
  });

  it("gives a non-Admin only the count and hasDepartedMatch", async () => {
    mockGetSession.mockResolvedValue(userSession);
    mockFindNameMatches.mockResolvedValue([departedMatch, activeMatch]);

    const res = await GET(makeRequest("?firstName=Jane&lastName=Smith"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(["count", "hasDepartedMatch"]);
    expect(body).toEqual({ count: 2, hasDepartedMatch: true });
  });

  it("leaks no names, dates, departments or a name echo to a non-Admin", async () => {
    mockGetSession.mockResolvedValue(userSession);
    mockFindNameMatches.mockResolvedValue([departedMatch]);

    const res = await GET(makeRequest("?firstName=Jane&lastName=Smith"));
    const raw = await res.text();

    // The whole body, as a string, must not contain any record detail — nor the
    // submitted name echoed back, which would confirm the probe in the response.
    for (const secret of [
      "Jane",
      "Smith",
      "Janey",
      "Fitter",
      "Maintenance",
      "Perth",
      "OLD-USI",
      "old notes",
      "2018",
      "2020",
    ]) {
      expect(raw).not.toContain(secret);
    }
  });

  it("reports hasDepartedMatch false when every match is still active", async () => {
    mockGetSession.mockResolvedValue(userSession);
    mockFindNameMatches.mockResolvedValue([activeMatch]);

    const body = await (
      await GET(makeRequest("?firstName=Jane&lastName=Smith"))
    ).json();

    expect(body).toEqual({ count: 1, hasDepartedMatch: false });
  });

  it("returns an empty result rather than 404 when nothing matches", async () => {
    mockGetSession.mockResolvedValue(userSession);

    const res = await GET(makeRequest("?firstName=Nobody&lastName=Here"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ count: 0, hasDepartedMatch: false });
  });

  it("passes the trimmed names through to the service", async () => {
    mockGetSession.mockResolvedValue(adminSession);

    await GET(makeRequest("?firstName=%20Jane%20&lastName=%20Smith%20"));

    expect(mockFindNameMatches).toHaveBeenCalledWith("Jane", "Smith");
  });

  it("returns 500 with no match detail when the lookup throws", async () => {
    mockGetSession.mockResolvedValue(adminSession);
    mockFindNameMatches.mockRejectedValue(new Error("db exploded"));

    const res = await GET(makeRequest("?firstName=Jane&lastName=Smith"));

    expect(res.status).toBe(500);
  });
});
