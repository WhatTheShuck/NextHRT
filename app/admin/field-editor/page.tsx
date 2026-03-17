import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { NavigationCard } from "@/components/navigation-card";
import { fieldEditorNavigationItems } from "@/lib/data";
import { headers } from "next/headers";
import { statsService } from "@/lib/services/statsService";

export default async function MetaPropertiesPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session === null) return redirect("/auth");

  if (session.user?.role !== "Admin") {
    redirect("/");
  }

  const stats = await statsService.getStats();

  const statCards = [
    {
      label: "Employees",
      active: stats.activeEmployees,
      total: stats.totalEmployees,
    },
    {
      label: "Departments",
      active: stats.activeDepartments,
      total: stats.totalDepartments,
    },
    {
      label: "Locations",
      active: stats.activeLocations,
      total: stats.totalLocations,
    },
    {
      label: "Training Programmes",
      active: stats.activeTraining,
      total: stats.totalTraining,
    },
    {
      label: "Ticket Categories",
      active: stats.activeTickets,
      total: stats.totalTickets,
    },
  ];

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6 md:space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-4xl font-bold">Meta Properties</h1>
          <p className="text-muted-foreground mt-2">
            Manage HRT&apos;s core data structures and configurations
          </p>
        </div>

        {/* Navigation Grid */}
        <div className="space-y-4 md:space-y-6">
          <h2 className="text-xl md:text-2xl font-semibold">Configuration Areas</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {fieldEditorNavigationItems.map((item) => (
              <NavigationCard key={item.href} {...item} />
            ))}
          </div>
        </div>

        {/* Quick Stats Section */}
        <div className="space-y-4 md:space-y-6">
          <h2 className="text-xl md:text-2xl font-semibold">Quick Stats</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {statCards.map(({ label, active, total }) => {
              const inactive = total - active;
              const activePct = total > 0 ? Math.round((active / total) * 100) : 0;
              return (
                <div key={label} className="bg-card p-5 rounded-lg border space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground">{label}</h3>
                  <p className="text-3xl font-bold">{total}</p>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div
                      className="bg-primary h-1.5 rounded-full"
                      style={{ width: `${activePct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span className="text-green-600 dark:text-green-400 font-medium">
                      {active} active
                    </span>
                    {inactive > 0 && (
                      <span>{inactive} inactive</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
