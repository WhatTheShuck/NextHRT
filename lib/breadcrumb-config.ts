export interface BreadcrumbItem {
  label: string;
  parent?: string;
}

export const breadcrumbConfig: Record<string, BreadcrumbItem> = {
  // Auth
  "/auth": { label: "Authentication" },

  // Admin section
  "/admin/field-editor": { label: "Field Editor" },
  "/admin/field-editor/departments": {
    label: "Departments",
    parent: "/admin/field-editor",
  },
  "/admin/field-editor/locations": {
    label: "Locations",
    parent: "/admin/field-editor",
  },
  "/admin/field-editor/tickets": {
    label: "Tickets",
    parent: "/admin/field-editor",
  },
  "/admin/field-editor/training": {
    label: "Training",
    parent: "/admin/field-editor",
  },
  "/admin/permissions": { label: "Permissions" },

  // Employees
  "/employees": { label: "Employees" },
  "/employees/[id]": { label: "Employee Profile", parent: "/employees" },

  // Bulk Training
  "/bulk-training": { label: "Bulk Training" },

  // Profile
  "/profile": { label: "Profile" },

  // Reports
  "/reports": { label: "Reports" },
  "/reports/employee": { label: "Employee Reports", parent: "/reports" },
  "/reports/employee/list": {
    label: "Employee List",
    parent: "/reports/employee",
  },
  "/reports/employee/needs-analysis": {
    label: "Employee Needs Analysis",
    parent: "/reports/employee",
  },
  "/reports/employee/onboarding": {
    label: "New Hires Report",
    parent: "/reports/employee",
  },
  "/reports/tickets": { label: "Ticket Reports", parent: "/reports" },
  "/reports/tickets/completed": {
    label: "Completed Tickets",
    parent: "/reports/tickets",
  },
  "/reports/tickets/expiring": {
    label: "Expiring Tickets",
    parent: "/reports/tickets",
  },
  "/reports/tickets/needs-analysis": {
    label: "Ticket Needs Analysis",
    parent: "/reports/tickets",
  },
  "/reports/tickets/required-tickets": {
    label: "All Required Tickets",
    parent: "/reports/tickets",
  },
  "/reports/training": { label: "Training Reports", parent: "/reports" },
  "/reports/training/completed": {
    label: "Completed Training",
    parent: "/reports/training",
  },
  "/reports/training/needs-analysis": {
    label: "Training Needs Analysis",
    parent: "/reports/training",
  },
  "/reports/training/required-training": {
    label: "All Required Training",
    parent: "/reports/training",
  },
};

export interface Breadcrumb {
  label: string;
  href: string;
}

export function generateBreadcrumbsFromPath(pathname: string): Breadcrumb[] {
  const crumbs: Breadcrumb[] = [{ label: "Home", href: "/" }];

  // Handle dynamic routes by replacing [id] with actual ID if present
  let configPath = pathname;
  const dynamicSegments = pathname.match(/\/[^\/]+(?=\/|$)/g);

  // Check if this is a dynamic route (contains numbers or UUIDs)
  if (dynamicSegments) {
    const lastSegment = dynamicSegments[dynamicSegments.length - 1];
    if (/\/\d+$/.test(pathname) || /\/[a-f0-9-]{36}$/i.test(pathname)) {
      // Replace the ID with [id] to match our config
      configPath = pathname.replace(/\/[^\/]+$/, "/[id]");
    }
  }

  // Build breadcrumbs from config
  const pathCrumbs: Breadcrumb[] = [];
  let currentPath: string | undefined = configPath;

  while (currentPath && currentPath !== "/" && breadcrumbConfig[currentPath]) {
    const config: BreadcrumbItem = breadcrumbConfig[currentPath];

    // For dynamic routes, use the actual path for href but config label
    const actualHref = currentPath === configPath ? pathname : currentPath;
    pathCrumbs.unshift({ label: config.label, href: actualHref });

    currentPath = config.parent;
  }

  return [...crumbs, ...pathCrumbs];
}

// Helper function to check if breadcrumbs should be shown
export function shouldShowBreadcrumbs(pathname: string): boolean {
  // Don't show on home page
  if (pathname === "/") return false;

  // Don't show on auth page (optional - you might want breadcrumbs here)
  if (pathname === "/auth") return false;

  // Show breadcrumbs if we have a config for this path or it's a dynamic route
  const configPath = pathname.replace(/\/[^\/]+$/, "/[id]");
  return (
    breadcrumbConfig[pathname] !== undefined ||
    breadcrumbConfig[configPath] !== undefined
  );
}
