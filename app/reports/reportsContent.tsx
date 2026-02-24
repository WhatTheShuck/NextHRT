"use client";
import React, { useEffect, useState } from "react";
import { NavigationCard } from "@/components/navigation-card";
import { reportsNavigationItems } from "@/lib/data";
import { authClient } from "@/lib/auth-client";

export function ReportsContent() {
  const { data: session } = authClient.useSession();
  const [visibleItems, setVisibleItems] = useState<
    typeof reportsNavigationItems
  >([]);
  const [isCheckingPermissions, setIsCheckingPermissions] = useState(true);
  useEffect(() => {
    async function checkPermissions() {
      if (!session?.user?.id) {
        setVisibleItems([]);
        setIsCheckingPermissions(false);
        return;
      }

      setIsCheckingPermissions(true);

      // Group items by their permission requirement to check each unique permission only once
      const permissionGroups = new Map<string, typeof reportsNavigationItems>();

      reportsNavigationItems.forEach((item) => {
        const permission = item.minimumAllowedPermission;
        if (!permissionGroups.has(permission)) {
          permissionGroups.set(permission, []);
        }
        permissionGroups.get(permission)!.push(item);
      });

      // Check each unique permission only once
      const uniquePermissions = Array.from(permissionGroups.keys());

      const permissionResults = await Promise.all(
        uniquePermissions.map(async (permission) => {
          const [resource, action] = permission.split(":");

          try {
            const result = await authClient.admin.hasPermission({
              userId: session.user.id,
              permissions: { [resource]: [action] },
            });

            const hasAccess = result?.data?.success === true;

            return { permission, hasAccess };
          } catch (error) {
            console.error(`Error checking permission ${permission}:`, error);
            return { permission, hasAccess: false };
          }
        }),
      );

      // Build the list of visible items based on permission results
      const itemsWithPermission: typeof reportsNavigationItems = [];

      permissionResults.forEach(({ permission, hasAccess }) => {
        if (hasAccess) {
          const items = permissionGroups.get(permission) || [];
          itemsWithPermission.push(...items);
        }
      });

      setVisibleItems(itemsWithPermission);
      setIsCheckingPermissions(false);
    }

    checkPermissions();
  }, [session?.user?.id]);
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
