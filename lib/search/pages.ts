// Every page the command palette can jump to. Built from the navigation card
// arrays in lib/data.ts so a new card is searchable without touching this file;
// EXTRA_PAGES covers pages that are only reachable from inside another page.
import {
  BarChart3,
  FileUp,
  GitCompareArrows,
  ListFilter,
  Send,
  UserCog,
  UserRoundCheck,
  type LucideIcon,
} from "lucide-react";
import {
  accessNavigationItems,
  emailNavigationItems,
  fieldEditorNavigationItems,
  formNavigationItems,
  landingPageNavigationItems,
  reportsNavigationItems,
  systemNavigationItems,
} from "@/lib/data";
import type { NavigationItem, Permission } from "@/lib/types";

export interface SearchPage {
  title: string;
  description?: string;
  /** Where it sits, e.g. "Reports › Training". Shown under the title. */
  section: string;
  href: string;
  icon: LucideIcon;
  permission: Permission;
  /** Self-service pages are dead ends until the account is linked to an employee. */
  requiresLinkedEmployee: boolean;
  /** Index pages that only list their sub-pages: pointless unless one of those is allowed. */
  requiresChildPage?: boolean;
  /** Synonyms and words people might type instead of the title. */
  keywords: string[];
}

// Words users reach for that aren't in a page's title or description.
const KEYWORDS: Record<string, string[]> = {
  "/reports": ["analytics", "export"],
  "/employees": [
    "staff",
    "people",
    "directory",
    "workers",
    "team",
    "find employee",
  ],
  "/forms": ["request"],
  "/access-check": ["privacy", "who can see me"],
  "/my-sops": ["standard operating procedures", "assessment", "task sheet"],
  "/sop-reviews": ["marking", "trainer", "grade"],
  "/quiz": ["quiz", "induction", "survey"],
  "/approvals": ["approve", "pending", "inbox", "requests"],
  "/admin/onboarding": ["new starter", "new hire", "approve"],
  "/required-training": ["record completion", "trainer", "deliver"],
  "/admin/quiz-results": ["questionnaire", "induction", "responses", "quiz editor", "quiz results"],
  "/admin/field-editor": ["field editor", "lookup", "catalogue", "dropdowns"],
  "/admin/email": ["mail", "smtp"],
  "/admin/access": ["roles", "security", "admin"],
  "/admin/system": ["config", "settings"],
  "/reports/employee/list": [
    "evacuation",
    "evac",
    "fire",
    "muster",
    "roll call",
    "headcount",
  ],
  "/reports/employee/onboarding": ["new starters", "new hires", "joiners"],
  "/reports/tickets/expiring": ["expiry", "renewal", "lapsing", "due"],
  "/reports/training/needs-analysis": [
    "tna",
    "gap analysis",
    "missing training",
  ],
  "/reports/tickets/needs-analysis": [
    "gap analysis",
    "missing tickets",
    "licences",
  ],
  "/reports/employee/needs-analysis": ["gap analysis", "compliance"],
  "/reports/training/required-training": ["compliance", "overdue", "mandatory"],
  "/reports/tickets/required-tickets": [
    "compliance",
    "overdue",
    "mandatory",
    "licences",
  ],
  "/reports/access/all": ["permissions", "visibility"],
  "/admin/email/templates": ["wording", "email text"],
  "/admin/email/log": ["sent", "outbox", "bounced", "failed"],
  "/admin/permissions": ["roles", "users", "link account", "rbac"],
  "/admin/org-chart": ["hierarchy", "reporting line", "managers", "tree"],
  "/admin/api-keys": ["tokens", "bearer", "integration"],
  "/admin/settings": ["config", "configuration", "preferences"],
  "/admin/jobs": ["queue", "cron", "scheduler", "tasks"],
  "/admin/logs": ["errors", "audit", "debug"],
  "/admin/field-editor/tickets": ["licences", "certifications", "tickets"],
  "/admin/field-editor/training": ["courses", "modules"],
  "/admin/field-editor/sops": ["standard operating procedures", "trainers"],
  "/admin/field-editor/hardware": ["laptops", "equipment", "devices"],
  "/admin/field-editor/programs": ["software", "applications", "apps"],
  "/forms/new-employee": [
    "onboarding",
    "new starter",
    "new hire",
    "add employee",
  ],
  "/forms/training-request": ["book training", "course request"],
};

type ExtraPage = Omit<SearchPage, "keywords" | "requiresLinkedEmployee"> & {
  keywords?: string[];
  requiresLinkedEmployee?: boolean;
};

const EXTRA_PAGES: ExtraPage[] = [
  {
    title: "Profile & Settings",
    description: "Your account, appearance and notification preferences",
    section: "Account",
    href: "/profile",
    icon: UserCog,
    permission: "employee:viewSelf",
    keywords: [
      "theme",
      "dark mode",
      "appearance",
      "notifications",
      "my account",
    ],
  },
  {
    title: "My Requests",
    description: "Track the status of forms you've submitted",
    section: "Forms",
    href: "/forms/my-requests",
    icon: Send,
    permission: "employee:viewSelf",
    requiresLinkedEmployee: true,
    keywords: ["status", "submitted", "training request"],
  },
  ...(
    [
      ["Employee Reports", "/reports/employee"],
      ["Training Reports", "/reports/training"],
      ["Ticket Reports", "/reports/tickets"],
      ["Access Reports", "/reports/access"],
    ] as const
  ).map(([title, href]): ExtraPage => ({
    title,
    section: "Reports",
    href,
    icon: BarChart3,
    permission: "reports:view",
    requiresChildPage: true,
  })),
  {
    title: "Workday Import",
    description: "Upload and review Workday org chart imports",
    section: "Admin › Org Chart",
    href: "/admin/org-chart/import",
    icon: FileUp,
    permission: "user:impersonate",
    keywords: ["upload", "sync", "hris"],
  },
  {
    title: "Import Ignore Rules",
    description: "Rows the Workday import should skip",
    section: "Admin › Org Chart",
    href: "/admin/org-chart/import/rules",
    icon: ListFilter,
    permission: "user:impersonate",
    keywords: ["workday", "exclude", "skip"],
  },
  {
    title: "Switch-over Readiness",
    description: "Check readiness before switching to line-manager authority",
    section: "Admin › Org Chart",
    href: "/admin/org-chart/switchover",
    icon: GitCompareArrows,
    permission: "user:impersonate",
    keywords: ["line manager", "authority mode", "migration"],
  },
  {
    title: "Delegated Access",
    description: "Grant someone access to another manager's team",
    section: "Admin › Org Chart",
    href: "/admin/org-chart/access",
    icon: UserRoundCheck,
    permission: "user:impersonate",
    keywords: ["delegate", "proxy", "acting manager", "cover"],
  },
];

const SECTIONS: [NavigationItem[], string][] = [
  [landingPageNavigationItems, "Home"],
  [reportsNavigationItems, "Reports"],
  [formNavigationItems, "Forms"],
  [emailNavigationItems, "Admin › Email"],
  [accessNavigationItems, "Admin › Users & Access"],
  [systemNavigationItems, "Admin › System"],
  [fieldEditorNavigationItems, "Admin › Dropdown Items"],
];

function reportSection(href: string): string {
  const area = href.split("/")[2];
  return area
    ? `Reports › ${area[0].toUpperCase()}${area.slice(1)}`
    : "Reports";
}

function build(): SearchPage[] {
  const pages = new Map<string, SearchPage>();
  for (const [items, section] of SECTIONS) {
    for (const item of items) {
      if (pages.has(item.href)) continue;
      pages.set(item.href, {
        title: item.title,
        description: item.description,
        section: section === "Reports" ? reportSection(item.href) : section,
        href: item.href,
        icon: item.icon,
        permission: item.minimumAllowedPermission,
        // Mirrors the landing page, which hides viewSelf cards for unlinked accounts.
        requiresLinkedEmployee:
          section === "Home" &&
          item.minimumAllowedPermission === "employee:viewSelf",
        keywords: KEYWORDS[item.href] ?? [],
      });
    }
  }
  for (const extra of EXTRA_PAGES) {
    if (pages.has(extra.href)) continue;
    pages.set(extra.href, {
      ...extra,
      requiresLinkedEmployee: extra.requiresLinkedEmployee ?? false,
      keywords: [...(extra.keywords ?? []), ...(KEYWORDS[extra.href] ?? [])],
    });
  }
  return [...pages.values()];
}

export const searchPages: SearchPage[] = build();
