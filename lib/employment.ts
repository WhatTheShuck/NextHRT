import { EmployeeStatus, EmploymentType } from "@/generated/prisma_client/client";

export function deriveEmploymentType(status: EmployeeStatus): EmploymentType {
  if (status === "Permanent" || status === "PartTimePermanent") {
    return "Internal" as EmploymentType;
  }
  return "External" as EmploymentType;
}
