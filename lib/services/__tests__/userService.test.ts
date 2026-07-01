// lib/services/__tests__/userService.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  };
  return { mockPrisma };
});

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import { userService } from "@/lib/services/userService";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getUsers", () => {
  it("returns full user data for Admin role", async () => {
    const fullUser = {
      id: "u1",
      name: "Admin User",
      email: "admin@example.com",
      role: "Admin",
      employeeId: 1,
      employee: { id: 1, legalFirstName: "Admin", legalLastName: "User", department: {}, location: {} },
      managedDepartments: [],
    };
    mockPrisma.user.findMany.mockResolvedValue([fullUser]);

    const result = await userService.getUsers({ userRole: "Admin" });

    // Admin gets the full findMany call with include
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ include: expect.anything() }),
    );
    expect(result[0]).toHaveProperty("email");
  });

  it("returns limited fields for non-Admin role", async () => {
    const limitedUser = { id: "u2", name: "Regular User", employeeId: 5, employee: null };
    mockPrisma.user.findMany.mockResolvedValue([limitedUser]);

    const result = await userService.getUsers({ userRole: "User" });

    // Non-admin gets a select call, not include
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ select: expect.anything() }),
    );
    expect(result[0]).toHaveProperty("id");
    expect(result[0]).toHaveProperty("name");
    expect(result[0]).toHaveProperty("employeeId");
  });
});
