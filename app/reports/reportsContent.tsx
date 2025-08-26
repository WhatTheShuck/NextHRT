"use client";
import React from "react";
import { NavigationCard } from "@/components/navigation-card";
import { reportsNavigationItems } from "@/lib/data";
import { hasRoleAccess } from "@/lib/apiRBAC";
import { useSession } from "next-auth/react";

export function ReportsContent() {
  const session = useSession();
  const userRole = session?.data?.user?.role || "User";
  const visibleItems = reportsNavigationItems.filter((item) =>
    hasRoleAccess(userRole, item.minimumAllowedRole),
  );
  return (
    <>
      {visibleItems.length > 0 && (
        <div className="space-y-6">
          <br />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleItems.map((item) => (
              <NavigationCard key={item.href} {...item} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export default ReportsContent;
