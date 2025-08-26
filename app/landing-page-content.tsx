"use client";
import React from "react";
import { NavigationCard } from "@/components/navigation-card";
import { landingPageNavigationItems } from "@/lib/data";
import { useSession } from "next-auth/react";
import { hasRoleAccess } from "@/lib/apiRBAC";

export function LandingPageContent() {
  const session = useSession();
  const userRole = session?.data?.user?.role || "User";
  const visibleItems = landingPageNavigationItems.filter((item) =>
    hasRoleAccess(userRole, item.minimumAllowedRole),
  );

  const nonAdminItems = visibleItems.filter(
    (item) => item.minimumAllowedRole !== "Admin",
  );
  const adminItems = visibleItems.filter(
    (item) => item.minimumAllowedRole === "Admin",
  );

  const getWelcomeMessage = () => {
    switch (userRole) {
      case "Admin":
        return "Access and manage all system resources from one central location";
      case "DepartmentManager":
        return "Manage your department and access reports from one central location";
      case "FireWarden":
        return "Access your personal resources and fire safety tools";
      case "User":
        return "Access your personal resources and training information";
      default:
        return "Access and manage your resources from one central location";
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold">Welcome to Dashboard</h1>
            <p className="text-muted-foreground mt-2">{getWelcomeMessage()}</p>
          </div>
        </div>

        {/* User Level Items - show for everyone who has User access */}
        {nonAdminItems.length > 0 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold">My Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {nonAdminItems.map((item) => (
                <NavigationCard key={item.href} {...item} />
              ))}
            </div>
          </div>
        )}

        {/* Admin Specific Items - show only for Admins */}
        {adminItems.length > 0 && userRole === "Admin" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold">Administrative Tools</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {adminItems.map((item) => (
                <NavigationCard key={item.href} {...item} />
              ))}
            </div>
          </div>
        )}

        {/* No access message */}
        {visibleItems.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              No available actions for your current role. Please contact an
              administrator.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
