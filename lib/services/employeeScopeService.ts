/**
 * Which employees a user's authority covers (docs/superpowers/specs/2026-10-09-document-upload-design.md
 * "Scope helper"). View = may see; Act = may submit documents for. Always includes the user's own
 * employee. RequirementService.getAccessibleEmployeeIds is deliberately separate: it leaves the
 * manager out of their own department-mode scope, and reports depend on that.
 */
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { UserRole } from "@/generated/prisma_client/client";
import { getChildDepartmentIds } from "@/lib/apiRBAC";
import { actScope, lineScope } from "@/lib/org/authority";
import { getAuthorityMode, loadOrg } from "./authorityService";

export type ScopeLevel = "View" | "Act";

async function can(role: string, action: "viewAll" | "viewDepartment"): Promise<boolean> {
  const result = await auth.api.userHasPermission({
    body: { role: role as UserRole, permissions: { employee: [action] } },
  });
  return result.success;
}

export async function getEmployeeIdsInScope(
  userId: string,
  role: string,
  { level }: { level: ScopeLevel },
): Promise<number[] | "all"> {
  if (await can(role, "viewAll")) return "all";

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { employeeId: true, managedDepartments: { select: { id: true, level: true } } },
  });
  const self = user?.employeeId ?? null;
  if (self === null) return [];

  // Line-manager mode deliberately doesn't gate on viewDepartment: resolveSessionRole already elevates anyone with scope.
  if ((await getAuthorityMode()) === "lineManager") {
    const { graph, grants } = await loadOrg();
    const scope = level === "Act" ? actScope(self, graph, grants) : lineScope(self, graph, grants);
    return [self, ...scope];
  }

  if (!(await can(role, "viewDepartment"))) return [self];
  if (user!.managedDepartments.length === 0) return [self];

  const deptIds = new Set<number>();
  for (const dept of user!.managedDepartments) {
    deptIds.add(dept.id);
    if (dept.level === 0) (await getChildDepartmentIds(dept.id)).forEach((id) => deptIds.add(id));
  }
  const employees = await prisma.employee.findMany({
    // Act matches line-manager mode, whose org graph holds active employees only.
    where: { departmentId: { in: [...deptIds] }, ...(level === "Act" ? { isActive: true } : {}) },
    select: { id: true },
  });
  return [...new Set([self, ...employees.map((e) => e.id)])];
}

export async function canActForEmployee(userId: string, role: string, employeeId: number): Promise<boolean> {
  const scope = await getEmployeeIdsInScope(userId, role, { level: "Act" });
  return scope === "all" || scope.includes(employeeId);
}

/** Prisma `where` fragment for employees in scope; `{}` for "all". */
export function scopeWhere(scope: number[] | "all"): { id?: { in: number[] } } {
  return scope === "all" ? {} : { id: { in: scope } };
}
