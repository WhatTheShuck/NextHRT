"use client";
import { NavigationCard } from "@/components/navigation-card";
import { landingPageNavigationItems } from "@/lib/data";
import { authClient } from "@/lib/auth-client";
import { useEffect, useState } from "react";

export function LandingPageContent() {
  const { data: session } = authClient.useSession();
  const userRole = session?.user.role || "User";
  const [visibleItems, setVisibleItems] = useState<
    typeof landingPageNavigationItems
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
      const permissionGroups = new Map<
        string,
        typeof landingPageNavigationItems
      >();

      landingPageNavigationItems.forEach((item) => {
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
      const itemsWithPermission: typeof landingPageNavigationItems = [];

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

  const nonAdminItems = visibleItems.filter(
    (item) => item.minimumAllowedPermission !== "user:impersonate",
  );
  const adminItems = visibleItems.filter(
    (item) => item.minimumAllowedPermission === "user:impersonate",
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

  if (isCheckingPermissions) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-6xl mx-auto">
          <p className="text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold">Welcome to Dashboard</h1>
            <p className="text-muted-foreground mt-2">{getWelcomeMessage()}</p>
          </div>
        </div>

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

        {visibleItems.length === 0 && (
          <div className="text-centre py-12">
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
