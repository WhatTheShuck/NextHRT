import { LucideIcon } from "lucide-react";
import {
  Employee,
  Department,
  Location,
  TrainingRecords,
  TicketRecords,
  Training,
  TrainingRevision,
  Ticket,
  User,
  History,
  TicketImage,
  TrainingImage,
  UserRole,
  TrainingRequirement,
  TrainingTicketExemption,
  TicketRequirement,
} from "@/generated/prisma_client/client";
import type { statement } from "./permissions";
// Cheeky type hackery to get the permission typing from permissions.ts. Thanks Claude
type PermissionKeys = keyof typeof statement;
type PermissionActions<T extends PermissionKeys> =
  (typeof statement)[T][number];

export type Permission = {
  [K in PermissionKeys]: `${K}:${PermissionActions<K>}`;
}[PermissionKeys];

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
  minimumAllowedPermission: Permission;
  badge?: number;
}

export interface EmployeeWithRelations extends Employee {
  department: Department;
  location: Location;
  trainingRecords?: TrainingRecords[];
  ticketRecords?: TicketRecords[];
  trainingTicketExemptions?: TrainingTicketExemption[];
}

export type EmployeeWithRequirementStatus = Employee & {
  requirementStatus: "Required" | "Exempted" | "Completed";
};

export interface TrainingRecordsWithRelations extends TrainingRecords {
  training?: TrainingWithRelations;
  personTrained?: EmployeeWithRelations;
  images?: TrainingImage[];
  revision?: TrainingRevision | null;
}

export interface TrainingRequirementWithRelations extends TrainingRequirement {
  training?: Training;
  department?: Department;
  location?: Location;
}

export interface TrainingWithRelations extends Training {
  requirements?: TrainingRequirementWithRelations[];
  _count?: {
    trainingRecords: number;
    revisions?: number;
  };
  trainingExemptions?: TrainingTicketExemptionWithRelations[];
  trainingRecords?: TrainingRecordsWithRelations[];
  revisions?: TrainingRevision[];
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
  legalFirstName: string;
  legalLastName: string;
  preferredFirstName?: string | null;
  preferredLastName?: string | null;
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
