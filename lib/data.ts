// basic data and configuration. Typically things that will be / can be readily changed
import { CompanyDetails, ContactDetails } from "./types";
import { NavigationItem } from "@/lib/types";
import {
  Users,
  ClipboardList,
  Settings,
  FileText,
  ShieldCheck,
  CalendarPlus,
  Building2,
  GraduationCap,
  MapPin,
  IdCard,
} from "lucide-react";

export const companyDetails: CompanyDetails = {
  name: process.env.NEXT_PUBLIC_COMPANY_NAME || "Please fill in ENV file",
  logoPath: "/logo.svg",
  domain_extension:
    process.env.NEXT_PUBLIC_COMPANY_DOMAIN_EXTENSION ||
    "Please fill in ENV file",
};
export const contactDetails: ContactDetails = {
  name: process.env.NEXT_PUBLIC_CONTACT_NAME || "Please fill in ENV File",
  phoneNumber:
    process.env.NEXT_PUBLIC_CONTACT_PHONE || "Please fill in ENV File",
  emailAdress:
    process.env.NEXT_PUBLIC_CONTACT_EMAIL || "Please fill in ENV File",
  role: process.env.NEXT_PUBLIC_CONTACT_ROLE || "Please fill in ENV File",
};

export const landingPageNavigationItems: NavigationItem[] = [
  {
    title: "Reports",
    description: "View and generate reports",
    icon: FileText,
    href: "/reports",
    allowedRoles: ["DepartmentManager", "Admin"], // Department managers and admins can see reports
  },
  {
    title: "User Profile",
    description: "View and edit user information",
    icon: Users,
    href: "/employees",
    allowedRoles: ["User", "DepartmentManager", "Admin"], // All roles can access their profile
  },
  {
    title: "Training Management",
    description: "Add and manage training for multiple users",
    icon: ClipboardList,
    href: "/bulk-training",
    allowedRoles: ["Admin"], // Only admins can bulk manage training
  },
  {
    title: "Dropdown Items",
    description: "Edit and manage dropdown menu items",
    icon: Settings,
    href: "/admin/field-editor",
    allowedRoles: ["Admin"], // Only admins can edit system configuration
  },
  {
    title: "User Permissions",
    description: "Manage user roles and permissions",
    icon: ShieldCheck,
    href: "/admin/permissions",
    allowedRoles: ["Admin"], // Only admins can manage permissions
  },
  {
    title: "Training Request",
    description: "Request approval to attending training",
    icon: CalendarPlus,
    href: "/training-request",
    allowedRoles: ["User", "DepartmentManager", "Admin"], // All roles can request training
  },
];

export const reportsNavigationItems: NavigationItem[] = [
  {
    title: "Current Employee List",
    description: "View the current employees. Useful for evacuation list",
    icon: Users,
    href: "/reports/employee/list",
    allowedRoles: ["DepartmentManager", "Admin"],
  },
  {
    title: "Training Completion",
    description: "See who has completed a specific type of training",
    icon: ClipboardList,
    href: "/reports/training/completed",
    allowedRoles: ["DepartmentManager", "Admin"],
  },
  {
    title: "Upcoming Ticket Expiration",
    description: "View upcoming expiring tickets for a specified period",
    icon: Settings,
    href: "/reports/tickets/expiring",
    allowedRoles: ["DepartmentManager", "Admin"],
  },
  {
    title: "Ticket Completion",
    description: "See who holds a specific type of ticket",
    icon: ShieldCheck,
    href: "/reports/tickets/completed",
    allowedRoles: ["DepartmentManager", "Admin"],
  },
];

export const fieldEditorNavigationItems: NavigationItem[] = [
  {
    title: "Departments",
    description: "Manage and organise department information",
    href: "/admin/field-editor/departments",
    icon: Building2,
    allowedRoles: ["Admin"],
  },
  {
    title: "Locations",
    description: "Configure and maintain location data",
    href: "/admin/field-editor/locations",
    icon: MapPin,
    allowedRoles: ["Admin"],
  },
  {
    title: "Training",
    description: "Administer training programmes and records",
    href: "/admin/field-editor/training",
    icon: GraduationCap,
    allowedRoles: ["Admin"],
  },
  {
    title: "Tickets",
    description: "Set up ticket categories and configurations",
    href: "/admin/field-editor/tickets",
    icon: IdCard,
    allowedRoles: ["Admin"],
  },
];
