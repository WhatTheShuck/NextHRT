import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuth } from "@/lib/api-auth";
import { getEmployeeIdsInScope, scopeWhere } from "@/lib/services/employeeScopeService";
import { employeeDisplayName } from "@/lib/services/employeeAddress";

// The employees the viewer may submit documents for (Act scope).
export async function GET(request: NextRequest) {
  const session = await getAuth(request);
  if (!session) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });

  const scope = await getEmployeeIdsInScope(session.user.id, session.user.role ?? "User", { level: "Act" });
  const employees = await prisma.employee.findMany({
    where: { isActive: true, ...scopeWhere(scope) },
    select: {
      id: true, legalFirstName: true, legalLastName: true, preferredFirstName: true, preferredLastName: true,
      title: true, department: { select: { name: true } },
    },
    orderBy: [{ legalFirstName: "asc" }, { legalLastName: "asc" }],
  });
  return NextResponse.json(
    employees.map((e) => ({ id: e.id, name: employeeDisplayName(e), subtitle: `${e.title} · ${e.department.name}` })),
  );
}
