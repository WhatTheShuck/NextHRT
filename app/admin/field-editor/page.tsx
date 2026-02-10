import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { NavigationCard } from "@/components/navigation-card";
import { fieldEditorNavigationItems } from "@/lib/data";
import api from "@/lib/axios";
import { headers } from "next/headers";

async function getStats() {
  // need to implement the service, rather than api call
  // try {
  // const response = await api.get("/api/stats");
  // return response.data;
  // } catch (error) {
  // console.error("Error fetching stats:", error);
  return {
    totalEmployees: 0,
    totalDepartments: 0,
    totalLocations: 0,
    totalTraining: 0,
    totalTickets: 0,
  };
  // }
}

export default async function MetaPropertiesPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session === null) return redirect("/auth");

  if (session.user?.role !== "Admin") {
    redirect("/");
  }

  const stats = await getStats();

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold">Meta Properties</h1>
            <p className="text-muted-foreground mt-2">
              Manage HRT&apos;s core data structures and configurations
            </p>
          </div>
        </div>

        {/* Navigation Grid */}
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold">Configuration Areas</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {fieldEditorNavigationItems.map((item) => (
              <NavigationCard key={item.href} {...item} />
            ))}
          </div>
        </div>

        {/* Quick Stats Section */}
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold">Quick Stats</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-card p-6 rounded-lg border">
              <h3 className="text-sm font-medium text-muted-foreground">
                Total Departments
              </h3>
              <p className="text-2xl font-bold">{stats.totalDepartments}</p>
            </div>
            <div className="bg-card p-6 rounded-lg border">
              <h3 className="text-sm font-medium text-muted-foreground">
                Active Locations
              </h3>
              <p className="text-2xl font-bold">{stats.totalLocations}</p>
            </div>
            <div className="bg-card p-6 rounded-lg border">
              <h3 className="text-sm font-medium text-muted-foreground">
                Training Programmes
              </h3>
              <p className="text-2xl font-bold">{stats.totalTraining}</p>
            </div>
            <div className="bg-card p-6 rounded-lg border">
              <h3 className="text-sm font-medium text-muted-foreground">
                Ticket Categories
              </h3>
              <p className="text-2xl font-bold">{stats.totalTickets}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
