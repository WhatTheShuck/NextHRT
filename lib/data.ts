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
  SlidersHorizontal,
  Eye,
  Cpu,
  ListCheck,
  CheckSquare,
  ScrollText,
  Network,
  KeyRound,
  Briefcase,
  Stethoscope,
  AppWindow,
  Laptop,
  ClipboardCheck,
  Inbox,
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
    minimumAllowedPermission: "reports:view",
  },
  {
    title: "User Profile",
    description: "View and edit user information",
    icon: Users,
    href: "/employees",
    minimumAllowedPermission: "employee:viewSelf",
  },
  {
    title: "Training Management",
    description: "Add and manage training for multiple users",
    icon: ClipboardList,
    href: "/bulk-training",
    minimumAllowedPermission: "user:impersonate", // Temp (xD) permission profile to only allow admins
  },
  {
    title: "Dropdown Items",
    description: "Edit and manage dropdown menu items",
    icon: Settings,
    href: "/admin/field-editor",
    minimumAllowedPermission: "user:impersonate",
  },
  {
    title: "User Permissions",
    description: "Manage user roles and permissions",
    icon: ShieldCheck,
    href: "/admin/permissions",
    minimumAllowedPermission: "user:impersonate",
  },
  {
    title: "Forms",
    description: "View and fill out forms",
    icon: ListCheck,
    href: "/forms",
    minimumAllowedPermission: "employee:viewSelf",
  },
  {
    title: "App Settings",
    description: "Configure application behaviour and matching rules",
    icon: SlidersHorizontal,
    href: "/admin/settings",
    minimumAllowedPermission: "user:impersonate",
  },
  {
    title: "Access Check",
    description: "See who has access to employee data",
    icon: Eye,
    href: "/access-check",
    minimumAllowedPermission: "employee:viewSelf",
  },
  {
    title: "Background Jobs",
    description: "Monitor and manage background job processing",
    icon: Cpu,
    href: "/admin/jobs",
    minimumAllowedPermission: "user:impersonate",
  },
  {
    title: "Approvals",
    description: "Review and action pending training requests",
    icon: CheckSquare,
    href: "/approvals",
    minimumAllowedPermission: "trainingRequest:approve",
  },
  {
    title: "Onboarding Requests",
    description: "Review, approve, or reject pending onboarding requests",
    icon: Inbox,
    href: "/admin/onboarding",
    minimumAllowedPermission: "user:impersonate",
  },
  {
    title: "Admin Logs",
    description: "View system log messages",
    icon: ScrollText,
    href: "/admin/logs",
    minimumAllowedPermission: "user:impersonate",
  },
  {
    title: "Org Chart",
    description: "Visualise department hierarchy and employee-user linkage",
    icon: Network,
    href: "/admin/org-chart",
    minimumAllowedPermission: "user:impersonate",
  },
  {
    title: "API Keys",
    description: "Create and manage bearer tokens for external service access",
    icon: KeyRound,
    href: "/admin/api-keys",
    minimumAllowedPermission: "user:impersonate",
  },
];

export const reportsNavigationItems: NavigationItem[] = [
  {
    title: "Current Employee List",
    description: "View the current employees. Useful for evacuation list",
    icon: Users,
    href: "/reports/employee/list",
    minimumAllowedPermission: "reports:viewEmployee",
  },
  {
    title: "New Hire Report",
    description: "View employees hired within a specified date range",
    icon: UserPlus,
    href: "/reports/employee/onboarding",
    minimumAllowedPermission: "reports:viewEmployee",
  },
  {
    title: "Employee Needs Analysis",
    description:
      "Identify what training or tickets need to be completed by an employee",
    icon: UserCheck,
    href: "/reports/employee/needs-analysis",
    minimumAllowedPermission: "department:manage",
  },
  {
    title: "Training Completion",
    description: "See who has completed a specific type of training",
    icon: ClipboardList,
    href: "/reports/training/completed",
    minimumAllowedPermission: "department:manage",
  },
  {
    title: "All Training Records",
    description:
      "See all training records. Beware, this could be a large report",
    icon: ClipboardList,
    href: "/reports/training/all",
    minimumAllowedPermission: "department:manage",
  },
  {
    title: "Training Needs Analysis",
    description: "Identify who needs to complete a specific type of training",
    icon: ClipboardList,
    href: "/reports/training/needs-analysis",
    minimumAllowedPermission: "department:manage",
  },
  {
    title: "All Required Training",
    description: "Identify who needs to complete any required training",
    icon: ClipboardList,
    href: "/reports/training/required-training",
    minimumAllowedPermission: "department:manage",
  },
  {
    title: "Upcoming Ticket Expiration",
    description: "View upcoming expiring tickets for a specified period",
    icon: Settings,
    href: "/reports/tickets/expiring",
    minimumAllowedPermission: "department:manage",
  },
  {
    title: "Ticket Completion",
    description: "See who holds a specific type of ticket",
    icon: ShieldCheck,
    href: "/reports/tickets/completed",
    minimumAllowedPermission: "department:manage",
  },
  {
    title: "All Ticket Records",
    description: "See all ticket records. Beware, this could be a large report",
    icon: ShieldCheck,
    href: "/reports/tickets/all",
    minimumAllowedPermission: "department:manage",
  },
  {
    title: "Ticket Needs Analysis",
    description: "Identify who needs to complete a specific type of ticket",
    icon: ShieldCheck,
    href: "/reports/tickets/needs-analysis",
    minimumAllowedPermission: "department:manage",
  },
  {
    title: "All Required Tickets",
    description: "Identify who needs to complete any required tickets",
    icon: ShieldCheck,
    href: "/reports/tickets/required-tickets",
    minimumAllowedPermission: "department:manage",
  },
  {
    title: "All Staff Access Report",
    description: "View which users can access each employee's data",
    icon: Eye,
    href: "/reports/access/all",
    minimumAllowedPermission: "user:impersonate",
  },
  {
    title: "Department Access Report",
    description: "View access by department",
    icon: Eye,
    href: "/reports/access/department",
    minimumAllowedPermission: "user:impersonate",
  },
  {
    title: "Location Access Report",
    description: "View access by location",
    icon: Eye,
    href: "/reports/access/location",
    minimumAllowedPermission: "user:impersonate",
  },
];

export const fieldEditorNavigationItems: NavigationItem[] = [
  {
    title: "Departments",
    description: "Manage and organise department information",
    href: "/admin/field-editor/departments",
    icon: Building2,
    minimumAllowedPermission: "user:impersonate",
  },
  {
    title: "Locations",
    description: "Configure and maintain location data",
    href: "/admin/field-editor/locations",
    icon: MapPin,
    minimumAllowedPermission: "user:impersonate",
  },
  {
    title: "Training",
    description: "Administer training programmes and records",
    href: "/admin/field-editor/training",
    icon: GraduationCap,
    minimumAllowedPermission: "user:impersonate",
  },
  {
    title: "Tickets",
    description: "Set up ticket categories and configurations",
    href: "/admin/field-editor/tickets",
    icon: IdCard,
    minimumAllowedPermission: "user:impersonate",
  },
  {
    title: "Job Families",
    description: "Manage job families used to drive onboarding prefills",
    href: "/admin/field-editor/job-families",
    icon: Briefcase,
    minimumAllowedPermission: "user:impersonate",
  },
  {
    title: "Medical Standards",
    description: "Manage pre-employment medical standards",
    href: "/admin/field-editor/medical-standards",
    icon: Stethoscope,
    minimumAllowedPermission: "user:impersonate",
  },
  {
    title: "Software Programs",
    description: "Manage the software-access program catalogue",
    href: "/admin/field-editor/programs",
    icon: AppWindow,
    minimumAllowedPermission: "user:impersonate",
  },
  {
    title: "Hardware",
    description: "Manage the hardware-request catalogue",
    href: "/admin/field-editor/hardware",
    icon: Laptop,
    minimumAllowedPermission: "user:impersonate",
  },
];
export const formNavigationItems: NavigationItem[] = [
  {
    title: "New Employee Form",
    description: "Fill in details for a new employee",
    icon: UserPlus,
    href: "/forms/new-employee",
    minimumAllowedPermission: "department:manage",
  },
  {
    title: "Training Request Form",
    description: "Request to training to be completed",
    icon: CalendarPlus,
    href: "/forms/training-request",
    minimumAllowedPermission: "employee:viewSelf",
  },
  {
    title: "Employee Onboarding",
    description: "Submit a new-hire onboarding request for Admin approval",
    icon: ClipboardCheck,
    href: "/forms/onboarding",
    minimumAllowedPermission: "department:manage",
  },
];
