import prisma from "@/lib/prisma";
import { deriveEmploymentType } from "@/lib/employment";
import { buildSwitchoverReport, type SwitchoverReport } from "@/lib/org/switchover";
import { displayName } from "@/lib/workday/suggestions";
import { createGrantInTx } from "./workdayImportService";

/**
 * Readiness for switching authority to reporting lines (docs/workday-org-import-spec.md §9.4,
 * §9.6). Creating the suggested grants stores them only; they take effect at the switch-over.
 */
class SwitchoverService {
  async getReport(): Promise<SwitchoverReport> {
    const [employees, departments, users, delegated] = await Promise.all([
      prisma.employee.findMany({
        select: {
          id: true,
          legalFirstName: true,
          legalLastName: true,
          preferredFirstName: true,
          preferredLastName: true,
          reportsToId: true,
          isActive: true,
          departmentId: true,
          status: true,
        },
      }),
      prisma.department.findMany({ select: { id: true, name: true, level: true, parentDepartmentId: true } }),
      // Any user with department grants: the pending-approvals list uses them with no role check.
      prisma.user.findMany({
        where: { managedDepartments: { some: {} } },
        select: { id: true, name: true, email: true, employeeId: true, managedDepartments: { select: { id: true } } },
        orderBy: { name: "asc" },
      }),
      prisma.delegatedAccess.findMany({
        select: { granteeEmployeeId: true, scopeManagerEmployeeId: true, departmentId: true },
      }),
    ]);

    return buildSwitchoverReport({
      employees: employees.map((e) => ({
        id: e.id,
        name: displayName(e),
        reportsToId: e.reportsToId,
        isActive: e.isActive,
        departmentId: e.departmentId,
        external: deriveEmploymentType(e.status) === "External",
      })),
      departments,
      departmentGrants: users.map((u) => ({
        userId: u.id,
        userName: u.name ?? u.email ?? u.id,
        employeeId: u.employeeId,
        departmentIds: u.managedDepartments.map((d) => d.id),
      })),
      delegatedGrants: delegated,
    });
  }

  /** Create the ticked migration grants, re-checked against a fresh report. */
  async createGrants(keys: string[], userId: string) {
    const report = await this.getReport();
    const available = new Map(
      report.grants.flatMap((g) => g.suggestions).filter((s) => !s.alreadyGranted).map((s) => [s.key, s]),
    );
    const wanted = [...new Set(keys)];
    const stale = wanted.filter((k) => !available.has(k));

    let created = 0;
    await prisma.$transaction(async (tx) => {
      for (const key of wanted) {
        const s = available.get(key);
        if (!s) continue;
        const grant = await createGrantInTx(tx, {
          granteeEmployeeId: s.granteeEmployeeId,
          scopeManagerEmployeeId: s.scopeManagerEmployeeId,
          departmentId: s.departmentId,
          source: "MigratedDeptGrant",
          createdByUserId: userId,
        });
        if (grant) created++;
      }
    });
    return { created, stale };
  }
}

export const switchoverService = new SwitchoverService();
