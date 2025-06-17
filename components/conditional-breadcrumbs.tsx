"use client";

import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import {
  generateBreadcrumbsFromPath,
  shouldShowBreadcrumbs,
} from "@/lib/breadcrumb-config";

export default function ConditionalBreadcrumbs() {
  const pathname = usePathname();

  if (!shouldShowBreadcrumbs(pathname)) {
    return null;
  }

  const breadcrumbs = generateBreadcrumbsFromPath(pathname);

  if (breadcrumbs.length <= 1) {
    return null;
  }

  return (
    <div className="container mx-auto px-1 pt-4">
      <Breadcrumb>
        <BreadcrumbList>
          {breadcrumbs.map((crumb, index) => (
            <div key={crumb.href} className="flex items-center">
              <BreadcrumbItem>
                {index === breadcrumbs.length - 1 ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink href={crumb.href}>
                    {crumb.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {index < breadcrumbs.length - 1 && <BreadcrumbSeparator />}
            </div>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}
