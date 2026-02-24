"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { NavigationCard } from "@/components/navigation-card";
import { reportsNavigationItems } from "@/lib/data";
import { authClient } from "@/lib/auth-client";

const REPORT_CATEGORIES = [
  {
    label: "Employee Reports",
    prefix: "/reports/employee",
    href: "/reports/employee",
  },
  {
    label: "Training Reports",
    prefix: "/reports/training",
    href: "/reports/training",
  },
  {
    label: "Ticket Reports",
    prefix: "/reports/tickets",
    href: "/reports/tickets",
  },
];

type ReportCategory = "employee" | "training" | "tickets";

export function ReportsContent({
  category,
}: {
  category?: ReportCategory;
}) {
  const items = category
    ? reportsNavigationItems.filter((item) =>
        item.href.startsWith(`/reports/${category}`),
      )
    : reportsNavigationItems;

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

      items.forEach((item) => {
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
          const permittedItems = permissionGroups.get(permission) || [];
          itemsWithPermission.push(...permittedItems);
        }
      });

      setVisibleItems(itemsWithPermission);
      setIsCheckingPermissions(false);
    }

    checkPermissions();
  }, [session?.user?.id]);

  if (visibleItems.length === 0) return null;

  const categorized = REPORT_CATEGORIES.map((cat) => ({
    ...cat,
    items: visibleItems.filter((item) => item.href.startsWith(cat.prefix)),
  })).filter((cat) => cat.items.length > 0);

  const isMultiCategory = categorized.length > 1;

  return (
    <div className="space-y-8 mt-6">
      {isMultiCategory ? (
        categorized.map((cat) => (
          <div key={cat.href} className="space-y-4">
            <Link
              href={cat.href}
              className="inline-flex items-center gap-1 group"
            >
              <h2 className="text-xl font-semibold group-hover:underline">
                {cat.label}
              </h2>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cat.items.map((item) => (
                <NavigationCard key={item.href} {...item} />
              ))}
            </div>
          </div>
        ))
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleItems.map((item) => (
            <NavigationCard key={item.href} {...item} />
          ))}
        </div>
      )}
    </div>
  );
}

export default ReportsContent;
