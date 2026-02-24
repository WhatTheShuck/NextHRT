// app/employees/page.tsx (Server Component)
import { Metadata } from "next";
import EmployeeDirectory from "./employee-directory";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

export const metadata: Metadata = {
  title: "Employee Directory",
  description: "Select an employee to view their records",
};

export default async function EmployeesPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) redirect("/auth");
  return (
    <div className="container mx-auto py-8">
      <EmployeeDirectory />
    </div>
  );
}
