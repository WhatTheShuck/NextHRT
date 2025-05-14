"use client";
import React from "react";
import { Label } from "@/components/ui/label";
import { NavigationCard } from "@/components/navigation-card";
import { landingPageNavigationItems } from "@/lib/data";
// import { useAdminMode } from "@/hooks/useAdminMode";

export function LandingPageContent() {
  // const { isAdmin, setIsAdmin } = useAdminMode();

  const visibleItems = landingPageNavigationItems.filter(
    (item) => !item.requiresAdmin || item.requiresAdmin /* && isAdmin */,
  );

  const regularItems = visibleItems.filter((item) => !item.requiresAdmin);
  const adminItems = visibleItems.filter((item) => item.requiresAdmin);

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold">Welcome to Dashboard</h1>
            <p className="text-muted-foreground mt-2">
              Access and manage your resources from one central location
            </p>
          </div>
          <div className="flex items-center space-x-2">
            {/* <Switch
                checked={isAdmin}
                onCheckedChange={setIsAdmin}
                id="admin-mode"
              /> */}
            <Label htmlFor="admin-mode">Admin Mode</Label>
          </div>
        </div>

        {/* Regular User Navigation */}
        {regularItems.length > 0 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {regularItems.map((item) => (
                <NavigationCard key={item.href} {...item} />
              ))}
            </div>
          </div>
        )}

        {/* Admin Navigation */}
        {adminItems.length > 0 /* && isAdmin */ && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold">Administrative Tools</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {adminItems.map((item) => (
                <NavigationCard key={item.href} {...item} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
