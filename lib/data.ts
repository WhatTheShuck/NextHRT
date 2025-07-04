// basic data and configuration. Typically things that will be / can be readily changed
import { CompanyDetails, ContactDetails } from "./types";
import { NavigationItem } from "@/lib/types";
import {
  Users,
  ClipboardList,
  Settings,
  FileText,
  ShieldCheck,
  Building2,
  GraduationCap,
  MapPin,
  IdCard,
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
  role: "IT Supervisor",
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
    href: "/employees",
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
    href: "/admin/field-editor",
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
    href: "/reports/tickets/expiring",
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

export const fieldEditorNavigationItems: NavigationItem[] = [
  {
    title: "Departments",
    description: "Manage and organise department information",
    href: "/admin/field-editor/departments",
    icon: Building2,
    requiresAdmin: false,
  },
  {
    title: "Locations",
    description: "Configure and maintain location data",
    href: "/admin/field-editor/locations",
    icon: MapPin,
    requiresAdmin: false,
  },
  {
    title: "Training",
    description: "Administer training programmes and records",
    href: "/admin/field-editor/training",
    icon: GraduationCap,
    requiresAdmin: false,
  },
  {
    title: "Tickets",
    description: "Set up ticket categories and configurations",
    href: "/admin/field-editor/tickets",
    icon: IdCard,
    requiresAdmin: false,
  },
];
