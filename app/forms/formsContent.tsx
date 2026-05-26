"use client";
import { NavigationCard } from "@/components/navigation-card";
import { formNavigationItems } from "@/lib/data";
import { authClient } from "@/lib/auth-client";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function FormPageContent() {
  const { data: session } = authClient.useSession();
  const [isCheckingPermissions, setIsCheckingPermissions] = useState(true);
  const [visibleItems, setVisibleItems] = useState<typeof formNavigationItems>(
    [],
  );

  useEffect(() => {
    async function checkPermissions() {
      if (!session?.user?.id) {
        setVisibleItems([]);
        setIsCheckingPermissions(false);
        return;
      }

      setIsCheckingPermissions(true);

      // Group items by their permission requirement to check each unique permission only once
      const permissionGroups = new Map<string, typeof formNavigationItems>();

      formNavigationItems.forEach((item) => {
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
      const itemsWithPermission: typeof formNavigationItems = [];

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

  if (isCheckingPermissions) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-screen-2xl mx-auto space-y-6 md:space-y-8">
          <div className="space-y-2">
            <Skeleton className="h-10 w-72" />
            <Skeleton className="h-5 w-96" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-8 w-36" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-32 w-full rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (visibleItems.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          No forms are available for your current role. Please contact an
          administrator.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleItems.map((item) => (
          <NavigationCard key={item.href} {...item} />
        ))}
      </div>
    </div>
  );
}
