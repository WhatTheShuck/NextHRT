import { buildEmployeeEmail } from "@/lib/employee-email";

interface NamedEmployee {
  legalFirstName: string;
  legalLastName: string;
  preferredFirstName: string | null;
  preferredLastName: string | null;
}

export function employeeDisplayName(e: NamedEmployee): string {
  return `${e.preferredFirstName ?? e.legalFirstName} ${e.preferredLastName ?? e.legalLastName}`;
}

/**
 * Where to email an employee about their own documents: the linked login's address, else the
 * company address built from preferred-or-legal names. Every active employee has a mailbox, linked
 * or not (spec decision 9).
 */
export function employeeAddress(e: NamedEmployee & { User: { email: string | null } | null }): string {
  return (
    e.User?.email ||
    buildEmployeeEmail(e.preferredFirstName ?? e.legalFirstName, e.preferredLastName ?? e.legalLastName)
  );
}

/** The `select` that satisfies `employeeAddress` + `employeeDisplayName`. */
export const EMPLOYEE_ADDRESS_SELECT = {
  id: true,
  legalFirstName: true,
  legalLastName: true,
  preferredFirstName: true,
  preferredLastName: true,
  User: { select: { email: true } },
} as const;

/** Line added to employee emails when their HRT login isn't linked yet (spec decision 9). */
export const UNLINKED_NOTE = "You can also give a copy to your manager to upload for you.";
