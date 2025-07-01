import { LucideIcon } from "lucide-react";
import {
  Employee,
  Department,
  Location,
  TrainingRecords,
  TicketRecords,
  Training,
  Ticket,
  User,
  History,
} from "@/generated/prisma_client";

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
  trainingRecords?: TrainingRecords[];
  ticketRecords?: TicketRecords[];
}
export interface TrainingRecordsWithRelations extends TrainingRecords {
  training?: Training;
  employee?: Employee;
}

export interface TicketRecordsWithRelations extends TicketRecords {
  ticket?: Ticket;
  employee?: Employee;
}

export interface UserWithRelations extends User {
  employee?: EmployeeWithRelations;
  managedDepartments?: Department[];
}

export type EmployeeFormData = {
  firstName: string;
  lastName: string;
  title: string;
  departmentId: number; // Form has parsed numbers
  locationId: number; // Form has parsed numbers
  notes: string | null;
  usi: string | null;
  isActive: boolean;
  startDate: string | null; // Form sends ISO string
};

export interface HistoryWithRelations extends History {
  user?: User;
}
