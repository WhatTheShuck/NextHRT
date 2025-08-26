import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import ReportsContent from "./reportsContent";
import { hasRoleAccess } from "@/lib/apiRBAC";

export default async function LandingPage() {
  const session = await auth();
  if (!session) redirect("/auth");
  const userRole = session?.user?.role || "User";
  if (!hasRoleAccess(userRole, "EmployeeViewer")) {
    redirect("/");
    // should probably return a 403 or something before the redirect?
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold">Reports</h1>
            <p className="text-muted-foreground mt-2">
              Generate a report for one of the following categories
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto space-y-8">
        <ReportsContent />
      </div>
    </div>
  );
}
