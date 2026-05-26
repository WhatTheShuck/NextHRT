// lib/services/__tests__/departmentService.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    department: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
  };
  return { mockPrisma };
});

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));
vi.mock("../auth", () => ({ auth: { api: { userHasPermission: vi.fn() } } }));
// departmentService imports auth for permission checks in other methods
vi.mock("@/lib/auth", () => ({ auth: { api: { userHasPermission: vi.fn() } } }));

import { departmentService } from "@/lib/services/departmentService";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getDepartmentManagers", () => {
  it("returns managers with employee data for a valid department", async () => {
    mockPrisma.department.findUnique.mockResolvedValue({ id: 1, name: "Engineering" });
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: "user-1",
        name: "Alice Smith",
        email: "alice@example.com",
        employeeId: 42,
        employee: { id: 42, firstName: "Alice", lastName: "Smith" },
      },
    ]);

    const result = await departmentService.getDepartmentManagers(1);

    expect(mockPrisma.department.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { managedDepartments: { some: { id: 1 } } },
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("user-1");
    expect(result[0].employee?.firstName).toBe("Alice");
  });

  it("throws DEPARTMENT_NOT_FOUND when department does not exist", async () => {
    mockPrisma.department.findUnique.mockResolvedValue(null);

    await expect(departmentService.getDepartmentManagers(999)).rejects.toThrow(
      "DEPARTMENT_NOT_FOUND",
    );
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
  });

  it("returns empty array when department has no managers", async () => {
    mockPrisma.department.findUnique.mockResolvedValue({ id: 2, name: "Ops" });
    mockPrisma.user.findMany.mockResolvedValue([]);

    const result = await departmentService.getDepartmentManagers(2);
    expect(result).toEqual([]);
  });
});
