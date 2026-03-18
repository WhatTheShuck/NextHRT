import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import ReportsContent from "../reportsContent";
import { headers } from "next/headers";

export default async function EmployeeReportsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session === null) return redirect("/auth");

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold">Employee Reports</h1>
            <p className="text-muted-foreground mt-2">
              Generate a report for one of the following employee categories
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto space-y-8">
        <ReportsContent category="employee" />
      </div>
    </div>
  );
}
