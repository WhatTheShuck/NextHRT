// basic data and configuration. Typically things that will be / can be readily changed
import { CompanyDetails, ContactDetails } from "./types";
import { NavigationItem } from "@/lib/types";
import {
  Users,
  ClipboardList,
  Settings,
  FileText,
  ShieldCheck,
} from "lucide-react";

export const companyDetails: CompanyDetails = {
  name: "KSB Australia",
  logoPath: "/logo.svg",
  domain_extension: "ksb.com.au",
};
export const contactDetails: ContactDetails = {
  name: "Brandon Wiedman",
  phoneNumber: "+61417734155",
  emailAdress: "Brandon.Wiedman@ksb.com.au",
  role: "IT Support Officer",
};

export const landingPageNavigationItems: NavigationItem[] = [
  {
    title: "Reports",
    description: "View and generate reports",
    icon: FileText,
    href: "/reports",
    requiresAdmin: false,
  },
  {
    title: "User Profile",
    description: "View and edit user information",
    icon: Users,
    href: "/users",
    requiresAdmin: false,
  },
  {
    title: "Training Management",
    description: "Add and manage training for multiple users",
    icon: ClipboardList,
    href: "/bulk-training",
    requiresAdmin: false,
  },
  {
    title: "Dropdown Items",
    description: "Edit and manage dropdown menu items",
    icon: Settings,
    href: "/admin/dropdown-items",
    requiresAdmin: true,
  },
  {
    title: "User Permissions",
    description: "Manage user roles and permissions",
    icon: ShieldCheck,
    href: "/admin/permissions",
    requiresAdmin: true,
  },
  {
    title: "Authentication",
    description:
      "Authentication Page so I don't have to keep typing it into the url bar",
    icon: ShieldCheck,
    href: "/auth",
    requiresAdmin: true,
  },
];

export const reportsNavigationItems: NavigationItem[] = [
  {
    title: "Current Employee List",
    description: "View the current employees. Useful for evacuation list",
    icon: Users,
    href: "/reports/employee/list",
    requiresAdmin: false,
  },
  {
    title: "Upcoming Employee Training",
    description: "View upcoming employee training in a specified period",
    icon: Users,
    href: "/reports/training/upcoming",
    requiresAdmin: false,
  },
  {
    title: "Training Completion",
    description: "See who has completed a specific type of training",
    icon: ClipboardList,
    href: "/reports/training/completed",
    requiresAdmin: false,
  },
  {
    title: "Upcoming Ticket Expiration",
    description: "View upcoming expiring tickets for a specified period",
    icon: Settings,
    href: "/reports/tickets/upcoming",
    requiresAdmin: false,
  },
  {
    title: "Ticket Completion",
    description: "See who holds a specific type of ticket",
    icon: ShieldCheck,
    href: "/reports/tickets/completed",
    requiresAdmin: false,
  },
];
