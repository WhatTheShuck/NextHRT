import prisma from "@/lib/prisma";
import { buildOrgGraph, delegatedScope, describeGrant, type GrantLevel } from "@/lib/org/authority";
import { displayName } from "@/lib/workday/suggestions";
import { createGrantInTx, deleteGrantInTx } from "./workdayImportService";

/**
 * Hand-managed delegated access (docs/workday-org-import-spec.md §8). The importer and the
 * switch-over page suggest grants; this is where an admin adds, re-levels and removes them.
 */

export interface GrantRow {
  id: number;
  granteeEmployeeId: number;
  granteeName: string;
  scopeManagerEmployeeId: number;
  scopeManagerName: string;
  departmentId: number | null;
  departmentName: string | null;
  jobFamilyId: number | null;
  jobFamilyName: string | null;
  level: GrantLevel;
  source: string;
  summary: string;
  /** Active people the grant reaches today, by name. */
  covers: string[];
  createdAt: string;
}

export interface GrantInput {
  granteeEmployeeId: number;
  scopeManagerEmployeeId: number;
  departmentId: number | null;
  jobFamilyId: number | null;
  level: GrantLevel;
}

export class GrantInputError extends Error {}

const nameSelect = { legalFirstName: true, legalLastName: true, preferredFirstName: true, preferredLastName: true } as const;

export const delegatedAccessService = {
  async list(): Promise<GrantRow[]> {
    const [grants, employees] = await Promise.all([
      prisma.delegatedAccess.findMany({
        include: {
          grantee: { select: nameSelect },
          scopeManager: { select: nameSelect },
          department: { select: { name: true } },
          jobFamily: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.employee.findMany({
        where: { isActive: true },
        select: { id: true, reportsToId: true, departmentId: true, jobFamilyId: true, ...nameSelect },
      }),
    ]);
    const graph = buildOrgGraph(employees);
    const nameOf = new Map(employees.map((e) => [e.id, displayName(e)]));

    return grants
      .map((g) => {
        const level: GrantLevel = g.level === "Act" ? "Act" : "View";
        const scopeManagerName = displayName(g.scopeManager);
        return {
          id: g.id,
          granteeEmployeeId: g.granteeEmployeeId,
          granteeName: displayName(g.grantee),
          scopeManagerEmployeeId: g.scopeManagerEmployeeId,
          scopeManagerName,
          departmentId: g.departmentId,
          departmentName: g.department?.name ?? null,
          jobFamilyId: g.jobFamilyId,
          jobFamilyName: g.jobFamily?.name ?? null,
          level,
          source: g.source,
          summary: describeGrant({ level, scopeName: scopeManagerName, departmentName: g.department?.name, jobFamilyName: g.jobFamily?.name }),
          covers: [...delegatedScope(g, graph)].map((id) => nameOf.get(id) ?? `#${id}`).sort(),
          createdAt: g.createdAt.toISOString(),
        };
      })
      .sort((a, b) => a.granteeName.localeCompare(b.granteeName) || a.scopeManagerName.localeCompare(b.scopeManagerName));
  },

  /** What the add form picks from: active employees, active departments and job families. */
  async options() {
    const [employees, departments, jobFamilies] = await Promise.all([
      prisma.employee.findMany({
        where: { isActive: true },
        select: { id: true, title: true, ...nameSelect },
      }),
      prisma.department.findMany({ where: { isActive: true, id: { gt: 0 } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
      prisma.jobFamily.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    ]);
    return {
      employees: employees.map((e) => ({ id: e.id, name: displayName(e), title: e.title })).sort((a, b) => a.name.localeCompare(b.name)),
      departments,
      jobFamilies,
    };
  },

  async create(input: GrantInput, userId: string) {
    if (input.granteeEmployeeId === input.scopeManagerEmployeeId) throw new GrantInputError("A person can't hold a grant on their own team.");
    const [grantee, scope, department, jobFamily] = await Promise.all([
      prisma.employee.findUnique({ where: { id: input.granteeEmployeeId }, select: { isActive: true } }),
      prisma.employee.findUnique({ where: { id: input.scopeManagerEmployeeId }, select: { isActive: true } }),
      input.departmentId === null ? null : prisma.department.findUnique({ where: { id: input.departmentId }, select: { id: true } }),
      input.jobFamilyId === null ? null : prisma.jobFamily.findUnique({ where: { id: input.jobFamilyId }, select: { id: true } }),
    ]);
    if (!grantee?.isActive || !scope?.isActive) throw new GrantInputError("Both people must be active employees.");
    if (input.departmentId !== null && !department) throw new GrantInputError("That department doesn't exist.");
    if (input.jobFamilyId !== null && !jobFamily) throw new GrantInputError("That job family doesn't exist.");

    const created = await prisma.$transaction((tx) => createGrantInTx(tx, { ...input, source: "Manual", createdByUserId: userId }));
    if (!created) throw new GrantInputError("That person already has a grant on that team with the same filters.");
    return created;
  },

  async setLevel(id: number, level: GrantLevel, userId: string) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.delegatedAccess.findUnique({ where: { id } });
      if (!existing) return null;
      if (existing.level === level) return existing;
      const updated = await tx.delegatedAccess.update({ where: { id }, data: { level } });
      await tx.history.create({
        data: {
          tableName: "DelegatedAccess",
          recordId: String(id),
          action: "UPDATE",
          changedFields: JSON.stringify(["level"]),
          oldValues: JSON.stringify({ level: existing.level }),
          newValues: JSON.stringify({ level }),
          userId,
        },
      });
      return updated;
    });
  },

  async remove(id: number, userId: string) {
    return prisma.$transaction((tx) => deleteGrantInTx(tx, id, userId));
  },
};
