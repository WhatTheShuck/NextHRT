import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/api-auth";
import { hasAccessToEmployee } from "@/lib/apiRBAC";
import prisma from "@/lib/prisma";
import { departmentService } from "@/lib/services/departmentService";
import { getApproversFor, getAuthorityMode } from "@/lib/services/authorityService";

const RELATION_NOTE = { manager: "Manager", oneUp: "Manager's manager" } as const;

// Suggested approvers for an employee's training request: their department's managers, or under
// line-manager authority their manager, the next manager up, and delegates acting for either.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuth(request);
  if (!session) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });

  const employeeId = Number((await params).id);
  if (!Number.isInteger(employeeId)) return NextResponse.json({ error: "Invalid employee ID" }, { status: 400 });
  if (!(await hasAccessToEmployee(session.user.id, employeeId, session.user.role as string))) {
    return NextResponse.json({ error: "Not authorised" }, { status: 403 });
  }

  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { departmentId: true } });
  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  if ((await getAuthorityMode()) !== "lineManager") {
    return NextResponse.json(await departmentService.getDepartmentManagers(employee.departmentId));
  }

  const approvers = await getApproversFor(employeeId);
  const users = await prisma.user.findMany({
    where: { employeeId: { in: approvers.map((a) => a.employeeId) } },
    select: {
      id: true,
      name: true,
      email: true,
      employeeId: true,
      employee: { select: { id: true, legalFirstName: true, legalLastName: true, preferredFirstName: true, preferredLastName: true } },
    },
  });
  const byEmployee = new Map(users.map((u) => [u.employeeId, u]));
  const nameOf = (id: number) => {
    const e = byEmployee.get(id)?.employee;
    return e ? `${e.preferredFirstName || e.legalFirstName} ${e.preferredLastName || e.legalLastName}` : "their manager";
  };

  // In approver order (manager first); people without an HRT account can't approve, so they're left out.
  return NextResponse.json(
    approvers.flatMap((a) => {
      const user = byEmployee.get(a.employeeId);
      if (!user) return [];
      const note = a.relation === "delegate" ? `On behalf of ${nameOf(a.actingFor!)}` : RELATION_NOTE[a.relation];
      return [{ ...user, note }];
    }),
  );
}
