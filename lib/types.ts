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
  TicketImage,
  UserRole,
  TrainingRequirement,
  TrainingTicketExemption,
  TicketRequirement,
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
  minimumAllowedRole: UserRole;
}

export interface EmployeeWithRelations extends Employee {
  department: Department;
  location: Location;
  trainingRecords?: TrainingRecords[];
  ticketRecords?: TicketRecords[];
}
export interface TrainingRecordsWithRelations extends TrainingRecords {
  training?: Training;
  personTrained?: EmployeeWithRelations;
}

export interface TrainingRequirementWithRelations extends TrainingRequirement {
  training?: Training;
  ticket?: Ticket;
  department?: Department;
  location?: Location;
}

export interface TrainingWithRelations extends Training {
  requirements?: TrainingRequirementWithRelations[];
  _count?: {
    trainingRecords: number;
  };
  trainingExemptions?: TrainingTicketExemptionWithRelations[];
  trainingRecords?: TrainingRecordsWithRelations[];
}
export interface TicketRecordsWithRelations extends TicketRecords {
  ticket?: Ticket;
  ticketHolder?: EmployeeWithRelations;
  images?: TicketImage[];
}

export interface TicketWithRelations extends Ticket {
  requirements?: TicketRequirementWithRelations[];
  _count?: {
    ticketRecords: number;
  };
  ticketExemptions?: TrainingTicketExemptionWithRelations[];
  ticketRecords?: TicketRecordsWithRelations[];
}

export interface TicketRequirementWithRelations extends TicketRequirement {
  ticket?: Ticket;
  department?: Department;
  location?: Location;
}

export interface TrainingTicketExemptionWithRelations
  extends TrainingTicketExemption {
  training?: Training;
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
