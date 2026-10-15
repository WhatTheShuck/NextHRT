import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn() },
    employee: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

const { hasPermission } = vi.hoisted(() => ({ hasPermission: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  auth: { api: { userHasPermission: ({ body }: any) => hasPermission(body.role, Object.values(body.permissions)[0]) } },
}));

const { mockAuthority } = vi.hoisted(() => ({
  mockAuthority: { getAuthorityMode: vi.fn(), loadOrg: vi.fn() },
}));
vi.mock("@/lib/services/authorityService", () => mockAuthority);

const { getChildDepartmentIds } = vi.hoisted(() => ({ getChildDepartmentIds: vi.fn() }));
vi.mock("@/lib/apiRBAC", () => ({ getChildDepartmentIds }));

import { buildOrgGraph } from "@/lib/org/authority";
import { getEmployeeIdsInScope, canActForEmployee } from "@/lib/services/employeeScopeService";

const can = (perms: string[]) =>
  hasPermission.mockImplementation(async (_role: string, actions: string[]) => ({
    success: actions.some((a) => perms.includes(a)),
  }));

beforeEach(() => {
  mockAuthority.getAuthorityMode.mockResolvedValue("department");
  getChildDepartmentIds.mockResolvedValue([]);
});

describe("getEmployeeIdsInScope", () => {
  it("admin (viewAll) → all", async () => {
    can(["viewAll"]);
    expect(await getEmployeeIdsInScope("u", "Admin", { level: "Act" })).toBe("all");
  });

  it("plain user → only themselves", async () => {
    can(["viewSelf"]);
    mockPrisma.user.findUnique.mockResolvedValue({ employeeId: 7, managedDepartments: [] });
    expect(await getEmployeeIdsInScope("u", "User", { level: "View" })).toEqual([7]);
  });

  it("department manager → self + managed departments + children of a level-0 department", async () => {
    can(["viewDepartment"]);
    mockPrisma.user.findUnique.mockResolvedValue({
      employeeId: 7,
      managedDepartments: [{ id: 5, level: 0 }],
    });
    getChildDepartmentIds.mockResolvedValue([6]);
    mockPrisma.employee.findMany.mockResolvedValue([{ id: 7 }, { id: 8 }, { id: 9 }]);

    const ids = await getEmployeeIdsInScope("u", "DepartmentManager", { level: "Act" });

    expect(mockPrisma.employee.findMany.mock.calls[0][0].where).toEqual({ departmentId: { in: [5, 6] }, isActive: true });
    expect(ids).toEqual([7, 8, 9]);
  });

  it("department manager, View level → inactive employees are not filtered out", async () => {
    can(["viewDepartment"]);
    mockPrisma.user.findUnique.mockResolvedValue({ employeeId: 7, managedDepartments: [{ id: 5, level: 1 }] });
    mockPrisma.employee.findMany.mockResolvedValue([{ id: 7 }, { id: 8 }]);

    await getEmployeeIdsInScope("u", "DepartmentManager", { level: "View" });

    expect(mockPrisma.employee.findMany.mock.calls[0][0].where).toEqual({ departmentId: { in: [5] } });
  });

  it("viewDepartment role with no managed departments → only themselves, no employee query", async () => {
    can(["viewDepartment"]);
    mockPrisma.user.findUnique.mockResolvedValue({ employeeId: 7, managedDepartments: [] });

    expect(await getEmployeeIdsInScope("u", "DepartmentManager", { level: "Act" })).toEqual([7]);
    expect(mockPrisma.employee.findMany).not.toHaveBeenCalled();
  });

  it("line-manager mode: Act excludes View grants, View includes them", async () => {
    can(["viewDepartment"]);
    mockAuthority.getAuthorityMode.mockResolvedValue("lineManager");
    mockPrisma.user.findUnique.mockResolvedValue({ employeeId: 1, managedDepartments: [] });
    mockAuthority.loadOrg.mockResolvedValue({
      graph: buildOrgGraph([
        { id: 1, reportsToId: null, departmentId: 1 },
        { id: 2, reportsToId: 1, departmentId: 1 },
        { id: 3, reportsToId: null, departmentId: 1 },
        { id: 4, reportsToId: 3, departmentId: 1 },
      ]),
      grants: [{ granteeEmployeeId: 1, scopeManagerEmployeeId: 3, departmentId: null, jobFamilyId: null, level: "View" }],
    });

    expect((await getEmployeeIdsInScope("u", "DepartmentManager", { level: "View" }) as number[]).sort()).toEqual([1, 2, 4]);
    expect((await getEmployeeIdsInScope("u", "DepartmentManager", { level: "Act" }) as number[]).sort()).toEqual([1, 2]);
  });

  it("unlinked non-admin → nobody", async () => {
    can(["viewSelf"]);
    mockPrisma.user.findUnique.mockResolvedValue({ employeeId: null, managedDepartments: [] });
    expect(await getEmployeeIdsInScope("u", "User", { level: "View" })).toEqual([]);
  });
});

describe("canActForEmployee", () => {
  it("true inside Act scope, false outside", async () => {
    can(["viewSelf"]);
    mockPrisma.user.findUnique.mockResolvedValue({ employeeId: 7, managedDepartments: [] });
    expect(await canActForEmployee("u", "User", 7)).toBe(true);
    expect(await canActForEmployee("u", "User", 8)).toBe(false);
  });
});
