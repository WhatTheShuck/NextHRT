import { LucideIcon } from "lucide-react";
import { Employee, Department, Location } from "@/generated/prisma_client";

export type CompanyDetails = {
  name: string;
  logoPath: string;
  domain_extension: string;
};

export type ContactDetails = {
  name: string;
  phoneNumber: string;
  emailAdress: string;
  role: string;
};

export interface NavigationItem {
  title: string;
  description?: string;
  icon: LucideIcon;
  href: string;
  requiresAdmin: boolean;
}

export interface EmployeeWithRelations extends Employee {
  department: Department;
  location: Location;
}
