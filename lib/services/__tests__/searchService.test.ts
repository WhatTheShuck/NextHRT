import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn() },
    employee: { findMany: vi.fn() },
    training: { findMany: vi.fn() },
    ticket: { findMany: vi.fn() },
    department: { findMany: vi.fn() },
    location: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

const { granted } = vi.hoisted(() => ({
  granted: { perms: new Set<string>() },
}));
vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      userHasPermission: async ({ body }: any) => {
        const [[resource, [action]]] = Object.entries(body.permissions) as [
          string,
          string[],
        ][];
        return { success: granted.perms.has(`${resource}:${action}`) };
      },
    },
  },
}));

const { getEmployeeIdsInScope } = vi.hoisted(() => ({
  getEmployeeIdsInScope: vi.fn(),
}));
vi.mock("@/lib/services/employeeScopeService", async () => ({
  getEmployeeIdsInScope,
  scopeWhere: (scope: number[] | "all") =>
    scope === "all" ? {} : { id: { in: scope } },
}));

import { getSearchIndex } from "@/lib/services/searchService";

const employee = (id: number, over: Record<string, unknown> = {}) => ({
  id,
  legalFirstName: "Jonathan",
  legalLastName: "Smith",
  preferredFirstName: null,
  preferredLastName: null,
  title: "Fitter",
  isActive: true,
  department: { name: "Maintenance" },
  location: { name: "Perth" },
  ...over,
});

beforeEach(() => {
  granted.perms = new Set(["employee:viewSelf"]);
  mockPrisma.user.findUnique.mockResolvedValue({ employeeId: 7 });
  mockPrisma.employee.findMany.mockResolvedValue([]);
  for (const t of ["training", "ticket", "department", "location"] as const) {
    mockPrisma[t].findMany.mockResolvedValue([]);
  }
});

describe("getSearchIndex", () => {
  it("only returns pages the role has permission for", async () => {
    getEmployeeIdsInScope.mockResolvedValue([7]);
    const { pages } = await getSearchIndex("u", "User");

    expect(pages).toContain("/my-sops");
    expect(pages).toContain("/profile");
    expect(pages).not.toContain("/reports");
    expect(pages).not.toContain("/admin/settings");
  });

  it("only offers a report category page when a report inside it is allowed", async () => {
    granted.perms = new Set([
      "employee:viewSelf",
      "reports:view",
      "reports:evac",
    ]);
    getEmployeeIdsInScope.mockResolvedValue([7]);
    const { pages } = await getSearchIndex("u", "FireWarden");

    expect(pages).toContain("/reports/employee/list");
    expect(pages).toContain("/reports/employee");
    expect(pages).not.toContain("/reports/access");
    expect(pages).not.toContain("/reports/training");
  });

  it("hides self-service pages from accounts with no linked employee, but keeps the profile", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ employeeId: null });
    getEmployeeIdsInScope.mockResolvedValue([]);
    const { pages, people } = await getSearchIndex("u", "User");

    expect(pages).not.toContain("/my-sops");
    expect(pages).not.toContain("/forms/my-requests");
    expect(pages).toContain("/profile");
    expect(people).toEqual([]);
    expect(mockPrisma.employee.findMany).not.toHaveBeenCalled();
  });

  it("limits people to the user's View scope", async () => {
    getEmployeeIdsInScope.mockResolvedValue([7, 8]);
    mockPrisma.employee.findMany.mockResolvedValue([employee(7), employee(8)]);
    await getSearchIndex("u", "DepartmentManager");

    expect(getEmployeeIdsInScope).toHaveBeenCalledWith(
      "u",
      "DepartmentManager",
      { level: "View" },
    );
    expect(mockPrisma.employee.findMany.mock.calls[0][0].where).toEqual({
      id: { in: [7, 8] },
    });
  });

  it("uses the preferred name and keeps the legal one searchable", async () => {
    getEmployeeIdsInScope.mockResolvedValue("all");
    mockPrisma.employee.findMany.mockResolvedValue([
      employee(1, { preferredFirstName: "Jon" }),
      employee(2),
    ]);
    const { people } = await getSearchIndex("u", "Admin");

    expect(people[0]).toMatchObject({
      name: "Jon Smith",
      legalName: "Jonathan Smith",
    });
    expect(people[1]).toMatchObject({
      name: "Jonathan Smith",
      legalName: null,
    });
  });

  it("only gives admins the catalogue, and routes SOPs to the SOP editor", async () => {
    getEmployeeIdsInScope.mockResolvedValue("all");
    mockPrisma.training.findMany.mockResolvedValue([
      { id: 1, title: "Forklift Safety", category: "Internal", isActive: true },
      { id: 2, title: "Lathe Setup", category: "SOP", isActive: true },
    ]);
    mockPrisma.ticket.findMany.mockResolvedValue([
      {
        id: 3,
        ticketCode: "LF",
        ticketName: "Forklift Licence",
        isActive: false,
      },
    ]);

    expect((await getSearchIndex("u", "DepartmentManager")).catalogue).toEqual(
      [],
    );
    expect(mockPrisma.training.findMany).not.toHaveBeenCalled();

    const { catalogue } = await getSearchIndex("u", "Admin");
    expect(catalogue.map((c) => [c.kind, c.href])).toEqual([
      ["training", "/admin/field-editor/training?q=Forklift%20Safety"],
      ["sop", "/admin/field-editor/sops?q=Lathe%20Setup"],
      ["ticket", "/admin/field-editor/tickets?q=Forklift%20Licence"],
    ]);
    expect(catalogue[2]).toMatchObject({ detail: "LF", active: false });
  });
});
