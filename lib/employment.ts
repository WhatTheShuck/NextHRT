import { EmployeeStatus, EmploymentType } from "@/generated/prisma_client/client";

export function deriveEmploymentType(status: EmployeeStatus): EmploymentType {
  if (status === "Permanent" || status === "PartTimePermanent") {
    return "Internal" as EmploymentType;
  }
  return "External" as EmploymentType;
}

/**
 * A closed employment stint, stored as the `oldValues` JSON of a `REHIRE`
 * History row. Names are snapshotted (not FK ids) so a stint still renders after
 * a department/location rename or delete.
 */
export interface PriorStint {
  startDate: string;
  finishDate: string;
  title: string;
  departmentName: string;
  locationName: string;
  status: string;
}

/** The shape `serializePriorStint` needs off a loaded employee record. */
interface EmployeeWithRelations {
  title: string;
  startDate: Date | string;
  finishDate: Date | string | null;
  status: string;
  department?: { name: string } | null;
  location?: { name: string } | null;
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

/**
 * Snapshot the employee's current (about-to-be-closed) employment stint.
 * `priorFinishDate` (ISO string) is used as the stint's finish date when the
 * record's own `finishDate` is null.
 */
export function serializePriorStint(
  employee: EmployeeWithRelations,
  priorFinishDate: string | null,
): PriorStint {
  const finish = employee.finishDate ?? priorFinishDate;
  return {
    startDate: toIso(employee.startDate),
    finishDate: finish ? toIso(finish) : "",
    title: employee.title,
    departmentName: employee.department?.name ?? "",
    locationName: employee.location?.name ?? "",
    status: employee.status,
  };
}

/**
 * Parse `REHIRE` History rows into `PriorStint`s, reading each row's `oldValues`
 * JSON. Order is preserved from the caller (pass rows newest-first). Rows with
 * missing or malformed `oldValues` are skipped, never thrown.
 */
export function parsePriorStints(
  rows: { oldValues?: string | null }[],
): PriorStint[] {
  const stints: PriorStint[] = [];
  for (const row of rows) {
    if (!row.oldValues) continue;
    try {
      stints.push(JSON.parse(row.oldValues) as PriorStint);
    } catch {
      // Skip malformed snapshots rather than failing the whole list.
    }
  }
  return stints;
}
