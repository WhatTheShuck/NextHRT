import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { UserRole } from "@/generated/prisma_client/client";
import { EmployeeListReport } from "./employee-list-report";

export default async function EmployeeListPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session === null) return redirect("/auth");

  const canViewEvac = await auth.api.userHasPermission({
    body: {
      role: session.user.role as UserRole,
      permissions: { reports: ["evac"] },
    },
  });

  if (!canViewEvac.success) {
    redirect("/");
  }

  return <EmployeeListReport />;
}
