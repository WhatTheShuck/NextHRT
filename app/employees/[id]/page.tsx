import { EmployeeProfile } from "./components/employee-profile";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
interface EmployeeDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function EmployeeDetailPage({
  params,
}: EmployeeDetailPageProps) {
  const session = await auth();
  if (!session) redirect("/auth");
  const resolvedParams = await params;
  const employeeId = parseInt(resolvedParams.id);

  // Validate that the ID is a valid number
  if (isNaN(employeeId)) {
    notFound();
  }

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <EmployeeProfile employeeId={employeeId} />
    </Suspense>
  );
}
