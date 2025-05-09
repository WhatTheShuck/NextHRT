"use client";
import React from "react";
import { NavigationCard } from "@/components/navigation-card";
import { reportsNavigationItems } from "@/lib/data";

const LandingPage: React.FC = () => {
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

      {/* Regular User Navigation */}
      {reportsNavigationItems && (
        <div className="space-y-6">
          <br />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reportsNavigationItems.map((item) => (
              <NavigationCard key={item.href} {...item} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LandingPage;
