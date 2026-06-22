"use client";
import { NavigationCard } from "@/components/navigation-card";
import { landingPageNavigationItems } from "@/lib/data";
import { authClient } from "@/lib/auth-client";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import api from "@/lib/axios";

export function LandingPageContent() {
  const { data: session } = authClient.useSession();
  const userRole = session?.user.role || "User";
  const [visibleItems, setVisibleItems] = useState<
    typeof landingPageNavigationItems
  >([]);
  const [isCheckingPermissions, setIsCheckingPermissions] = useState(true);
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);
  const [pendingOnboardingCount, setPendingOnboardingCount] = useState(0);

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

      // Fetch pending counts for badges (best-effort, no error shown)
      api
        .get<{ count: number }>("/api/approvals/pending/count")
        .then((res) => setPendingApprovalCount(res.data.count))
        .catch(() => {});
      api
        .get<{ count: number }>("/api/onboarding/pending/count")
        .then((res) => setPendingOnboardingCount(res.data.count))
        .catch(() => {});
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
      <div className="max-w-screen-2xl mx-auto min-h-screen bg-background p-4 md:p-8">
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

  return (
    <div className="max-w-screen-2xl mx-auto min-h-screen bg-background p-4 ">
      <div className="space-y-6 md:space-y-8">
        <div>
          <h1 className="text-2xl md:text-4xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-2">{getWelcomeMessage()}</p>
        </div>

        {nonAdminItems.length > 0 && (
          <div className="space-y-6">
            <h2 className="text-xl md:text-2xl font-semibold">My Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {nonAdminItems.map((item) => (
                <NavigationCard
                  key={item.href}
                  {...item}
                  badge={
                    item.href === "/approvals"
                      ? pendingApprovalCount
                      : undefined
                  }
                />
              ))}
            </div>
          </div>
        )}

        {adminItems.length > 0 && userRole === "Admin" && (
          <div className="space-y-6">
            <h2 className="text-xl md:text-2xl font-semibold">
              Administrative Tools
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {adminItems.map((item) => (
                <NavigationCard
                  key={item.href}
                  {...item}
                  badge={
                    item.href === "/admin/onboarding"
                      ? pendingOnboardingCount
                      : undefined
                  }
                />
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
