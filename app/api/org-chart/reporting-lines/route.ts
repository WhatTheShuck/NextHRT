import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import prisma from "@/lib/prisma";
import { deriveEmploymentType } from "@/lib/employment";

// Active employees with their line manager, plus delegated-access grants, for the
// reporting-lines view of the org chart (docs/workday-org-import-spec.md §2).
export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if ("response" in guard) return guard.response;

  try {
    const [employees, grants] = await Promise.all([
      prisma.employee.findMany({
        where: { isActive: true },
        select: {
          id: true,
          legalFirstName: true,
          legalLastName: true,
          preferredFirstName: true,
          preferredLastName: true,
          title: true,
          status: true,
          reportsToId: true,
          department: { select: { name: true } },
          User: { select: { id: true } },
        },
      }),
      prisma.delegatedAccess.findMany({
        where: { grantee: { isActive: true } },
        select: {
          id: true,
          granteeEmployeeId: true,
          scopeManagerEmployeeId: true,
          source: true,
          level: true,
          department: { select: { name: true } },
          jobFamily: { select: { name: true } },
        },
      }),
    ]);

    return NextResponse.json({
      employees: employees.map((e) => ({
        id: e.id,
        name: `${e.preferredFirstName || e.legalFirstName} ${e.preferredLastName || e.legalLastName}`,
        title: e.title,
        department: e.department.name,
        reportsToId: e.reportsToId,
        external: deriveEmploymentType(e.status) === "External",
        hasLogin: !!e.User,
      })),
      grants: grants.map((g) => ({
        id: g.id,
        granteeEmployeeId: g.granteeEmployeeId,
        scopeManagerEmployeeId: g.scopeManagerEmployeeId,
        department: g.department?.name ?? null,
        jobFamily: g.jobFamily?.name ?? null,
        level: g.level === "Act" ? "Act" : "View",
        source: g.source,
      })),
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch reporting lines" }, { status: 500 });
  }
}
