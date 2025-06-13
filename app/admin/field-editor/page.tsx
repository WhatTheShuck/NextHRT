import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { NavigationCard } from "@/components/navigation-card";
import { fieldEditorNavigationItems } from "@/lib/data";

export default async function MetaPropertiesPage() {
  const session = await auth();

  // Redirect if not authenticated
  if (!session) {
    redirect("/auth");
  }

  if (session.user?.role !== "Admin") {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold">Meta Properties</h1>
            <p className="text-muted-foreground mt-2">
              Manage HRT's core data structures and configurations
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

        {/* Optional: Recent Activity or Statistics Section */}
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold">Quick Stats</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-card p-6 rounded-lg border">
              <h3 className="text-sm font-medium text-muted-foreground">
                Total Departments
              </h3>
              <p className="text-2xl font-bold">-</p>
            </div>
            <div className="bg-card p-6 rounded-lg border">
              <h3 className="text-sm font-medium text-muted-foreground">
                Active Locations
              </h3>
              <p className="text-2xl font-bold">-</p>
            </div>
            <div className="bg-card p-6 rounded-lg border">
              <h3 className="text-sm font-medium text-muted-foreground">
                Training Programmes
              </h3>
              <p className="text-2xl font-bold">-</p>
            </div>
            <div className="bg-card p-6 rounded-lg border">
              <h3 className="text-sm font-medium text-muted-foreground">
                Ticket Categories
              </h3>
              <p className="text-2xl font-bold">-</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
