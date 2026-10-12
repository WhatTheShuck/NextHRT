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

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) redirect("/auth");
  const { q: rawQ } = await searchParams;
  const q = (Array.isArray(rawQ) ? rawQ[0] : rawQ) ?? "";
  return (
    <div className="container mx-auto px-4 sm:px-6 py-8">
      {/* ?q= comes from the search palette; keyed so a new query resets the filter */}
      <EmployeeDirectory key={q} initialQuery={q} />
    </div>
  );
}
