"use client";
import React from "react";
import { NavigationCard } from "@/components/navigation-card";
import { landingPageNavigationItems } from "@/lib/data";
import { useSession } from "next-auth/react";

export function LandingPageContent() {
  const session = useSession();
  const userRole = session?.data?.user?.role || "User";
  const visibleItems = landingPageNavigationItems.filter((item) =>
    item.allowedRoles.includes(userRole),
  );

  const userItems = visibleItems.filter(
    (item) =>
      item.allowedRoles.includes("User") &&
      !item.allowedRoles.includes("Admin") &&
      !item.allowedRoles.includes("DepartmentManager"),
  );

  const departmentManagerItems = visibleItems.filter(
    (item) =>
      item.allowedRoles.includes("DepartmentManager") &&
      !item.allowedRoles.includes("Admin"),
  );

  const adminItems = visibleItems.filter(
    (item) =>
      item.allowedRoles.includes("Admin") && item.allowedRoles.length === 1, // Only admin-specific items
  );

  const sharedItems = visibleItems.filter(
    (item) =>
      item.allowedRoles.length > 1 && // Items shared across multiple roles
      !adminItems.includes(item) &&
      !departmentManagerItems.includes(item) &&
      !userItems.includes(item),
  );

  const getSectionTitle = () => {
    switch (userRole) {
      case "Admin":
        return "Quick Actions";
      case "DepartmentManager":
        return "Department Management";
      case "User":
        return "My Actions";
      default:
        return "Quick Actions";
    }
  };

  const getWelcomeMessage = () => {
    switch (userRole) {
      case "Admin":
        return "Access and manage all system resources from one central location";
      case "DepartmentManager":
        return "Manage your department and access reports from one central location";
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

        {/* Shared Items (available to multiple roles) */}
        {sharedItems.length > 0 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold">{getSectionTitle()}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sharedItems.map((item) => (
                <NavigationCard key={item.href} {...item} />
              ))}
            </div>
          </div>
        )}

        {/* Department Manager Specific Items */}
        {departmentManagerItems.length > 0 &&
          userRole === "DepartmentManager" && (
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold">Department Tools</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {departmentManagerItems.map((item) => (
                  <NavigationCard key={item.href} {...item} />
                ))}
              </div>
            </div>
          )}

        {/* Admin Specific Items */}
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
