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
  UserPlus,
  UserCheck,
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
    minimumAllowedRole: "EmployeeViewer",
  },
  {
    title: "User Profile",
    description: "View and edit user information",
    icon: Users,
    href: "/employees",
    minimumAllowedRole: "User",
  },
  {
    title: "Training Management",
    description: "Add and manage training for multiple users",
    icon: ClipboardList,
    href: "/bulk-training",
    minimumAllowedRole: "Admin",
  },
  {
    title: "Dropdown Items",
    description: "Edit and manage dropdown menu items",
    icon: Settings,
    href: "/admin/field-editor",
    minimumAllowedRole: "Admin",
  },
  {
    title: "User Permissions",
    description: "Manage user roles and permissions",
    icon: ShieldCheck,
    href: "/admin/permissions",
    minimumAllowedRole: "Admin",
  },
  {
    title: "Training Request",
    description: "Request approval to attending training",
    icon: CalendarPlus,
    href: "/training-request",
    minimumAllowedRole: "User",
  },
];

export const reportsNavigationItems: NavigationItem[] = [
  {
    title: "Current Employee List",
    description: "View the current employees. Useful for evacuation list",
    icon: Users,
    href: "/reports/employee/list",
    minimumAllowedRole: "EmployeeViewer",
  },
  {
    title: "New Hire Report",
    description: "View employees hired within a specified date range",
    icon: UserPlus,
    href: "/reports/employee/onboarding",
    minimumAllowedRole: "EmployeeViewer",
  },
  {
    title: "Employee Needs Analysis",
    description:
      "Identify what training or tickets need to be completed by an employee",
    icon: UserCheck,
    href: "/reports/employee/needs-analysis",
    minimumAllowedRole: "DepartmentManager",
  },
  {
    title: "Training Completion",
    description: "See who has completed a specific type of training",
    icon: ClipboardList,
    href: "/reports/training/completed",
    minimumAllowedRole: "DepartmentManager",
  },
  {
    title: "All Training Records",
    description:
      "See all training records. Beware, this could be a large report",
    icon: ClipboardList,
    href: "/reports/training/all",
    minimumAllowedRole: "DepartmentManager",
  },
  {
    title: "Training Needs Analysis",
    description: "Identify who needs to complete a specific type of training",
    icon: ClipboardList,
    href: "/reports/training/needs-analysis",
    minimumAllowedRole: "DepartmentManager",
  },
  {
    title: "All Required Training",
    description: "Identify who needs to complete any required training",
    icon: ClipboardList,
    href: "/reports/training/required-training",
    minimumAllowedRole: "DepartmentManager",
  },
  {
    title: "Upcoming Ticket Expiration",
    description: "View upcoming expiring tickets for a specified period",
    icon: Settings,
    href: "/reports/tickets/expiring",
    minimumAllowedRole: "DepartmentManager",
  },
  {
    title: "Ticket Completion",
    description: "See who holds a specific type of ticket",
    icon: ShieldCheck,
    href: "/reports/tickets/completed",
    minimumAllowedRole: "DepartmentManager",
  },
  {
    title: "All Ticket Records",
    description: "See all ticket records. Beware, this could be a large report",
    icon: ShieldCheck,
    href: "/reports/tickets/all",
    minimumAllowedRole: "DepartmentManager",
  },
  {
    title: "Ticket Needs Analysis",
    description: "Identify who needs to complete a specific type of ticket",
    icon: ShieldCheck,
    href: "/reports/tickets/needs-analysis",
    minimumAllowedRole: "DepartmentManager",
  },
  {
    title: "All Required Tickets",
    description: "Identify who needs to complete any required tickets",
    icon: ShieldCheck,
    href: "/reports/tickets/required-tickets",
    minimumAllowedRole: "DepartmentManager",
  },
];

export const fieldEditorNavigationItems: NavigationItem[] = [
  {
    title: "Departments",
    description: "Manage and organise department information",
    href: "/admin/field-editor/departments",
    icon: Building2,
    minimumAllowedRole: "Admin",
  },
  {
    title: "Locations",
    description: "Configure and maintain location data",
    href: "/admin/field-editor/locations",
    icon: MapPin,
    minimumAllowedRole: "Admin",
  },
  {
    title: "Training",
    description: "Administer training programmes and records",
    href: "/admin/field-editor/training",
    icon: GraduationCap,
    minimumAllowedRole: "Admin",
  },
  {
    title: "Tickets",
    description: "Set up ticket categories and configurations",
    href: "/admin/field-editor/tickets",
    icon: IdCard,
    minimumAllowedRole: "Admin",
  },
];
