import { Prisma, EmployeeStatus } from "@/generated/prisma_client/client";
import { deriveEmploymentType, serializePriorStint } from "@/lib/employment";
import { enqueue } from "@/lib/jobs/jobQueue";

/**
 * The caller's already-reconciled field values for the new stint. The server owns
 * the archive snapshot, so there are no snapshot/archive fields here.
 *
 * Optional fields keep the `undefined` (don't touch) / `null` (clear) distinction
 * intact end to end — both callers rely on it, since neither reconciles every
 * column (the onboarding request has no `usi`/`notes` at all).
 */
export interface RehireData {
  /** `Date` as well as `string`: the onboarding path merges a `Date` from the request. */
  startDate: string | Date;
  priorFinishDate?: string | null;
  title: string;
  departmentId: number;
  locationId: number;
  status: string;
  jobFamilyId?: number | null;
  usi?: string | null;
  notes?: string | null;
  preferredFirstName?: string | null;
  preferredLastName?: string | null;
  /** Written only when supplied — a rehire must not silently rename the record. */
  legalFirstName?: string;
  legalLastName?: string;
}

function parseDate(value: string | Date, code: string): Date {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  // Without this an `Invalid Date` makes every subsequent comparison false, so
  // the INVALID_REHIRE_DATE guard below silently evaluates to "pass".
  if (isNaN(date.getTime())) {
    throw new Error(code);
  }
  return date;
}

/**
 * Archive the prior stint as a parseable `REHIRE` History row, then reactivate the
 * live record with the caller's reconciled values.
 *
 * A free function taking its `tx` rather than a method on `EmployeeService`,
 * because `onboardingService.approveRequest` is already inside a transaction and
 * must not nest one — the better-sqlite3 adapter runs on a single connection, so
 * an inner `BEGIN` fails or deadlocks. It also means `onboardingService` does not
 * have to import `employeeService` (a dependency it otherwise has no need for)
 * just to reach one function.
 *
 * All validation lives here so both callers get it identically. Note the
 * `findUnique` is inside the caller's transaction, which closes the TOCTOU window
 * the old implementation had between the active check and the update.
 *
 * IMPORTANT: keep `include: { department: true, location: true }` on the returned
 * update. `onboardingFanOutService` infers `FanOutEmployee` from
 * `approveRequest`'s return type and reads `employee.department.name`.
 */
export async function rehireInTx(
  tx: Prisma.TransactionClient,
  employeeId: number,
  data: RehireData,
  userId: string,
) {
  // 1. Load the existing record with the relations we snapshot names from.
  const existing = await tx.employee.findUnique({
    where: { id: employeeId },
    include: { department: true, location: true },
  });

  if (!existing) {
    throw new Error("EMPLOYEE_NOT_FOUND");
  }

  // 2. Only a departed employee can be rehired.
  if (existing.isActive) {
    throw new Error("ACTIVE_EMPLOYEE");
  }

  // 3. Resolve the prior stint's finish date (record's own, else supplied).
  const priorFinish = existing.finishDate
    ? existing.finishDate
    : data.priorFinishDate
      ? parseDate(data.priorFinishDate, "INVALID_REHIRE_DATE")
      : null;
  if (!priorFinish) {
    throw new Error("MISSING_FINISH_DATE");
  }
  const priorFinishDate = priorFinish.toISOString();

  // 4. The new stint must start strictly after the prior one ends.
  const rehireStart = parseDate(data.startDate, "INVALID_REHIRE_DATE");
  if (rehireStart <= priorFinish) {
    throw new Error("INVALID_REHIRE_DATE");
  }

  const status = data.status as EmployeeStatus;
  const oldStint = serializePriorStint(existing, priorFinishDate);
  const newStint = {
    startDate: rehireStart.toISOString(),
    finishDate: null,
    title: data.title,
    departmentId: data.departmentId,
    locationId: data.locationId,
    status: data.status,
  };

  await tx.history.create({
    data: {
      tableName: "Employee",
      recordId: String(employeeId),
      action: "REHIRE",
      oldValues: JSON.stringify(oldStint),
      newValues: JSON.stringify(newStint),
      // Full prior-record snapshot kept purely as an audit backup.
      changedFields: JSON.stringify(existing),
      userId,
    },
  });

  return tx.employee.update({
    where: { id: employeeId },
    data: {
      startDate: rehireStart,
      finishDate: null,
      isActive: true,
      hasPriorEmployment: true,
      title: data.title,
      department: { connect: { id: data.departmentId } },
      location: { connect: { id: data.locationId } },
      status,
      employmentType: deriveEmploymentType(status),
      jobFamily:
        data.jobFamilyId !== undefined
          ? data.jobFamilyId
            ? { connect: { id: data.jobFamilyId } }
            : { disconnect: true }
          : undefined,
      usi: data.usi,
      notes: data.notes,
      preferredFirstName: data.preferredFirstName,
      preferredLastName: data.preferredLastName,
      // Legal names only when the caller reconciled them — a case-only difference
      // is the normal case now that matching is case-insensitive.
      legalFirstName: data.legalFirstName,
      legalLastName: data.legalLastName,
      // Both are Snipe-IT-synced and survive offboarding, so a reactivated record
      // would otherwise reappear holding a landline and SIM the employee handed
      // back — and a stale `mobile` makes them a phone-number-reuse candidate for
      // a number that has since been reassigned. The Snipe sync repopulates these
      // once new hardware is issued.
      phone: null,
      mobile: null,
    },
    include: {
      department: true,
      location: true,
    },
  });
}

/**
 * Recompute the employee's requirements cache after a rehire or an offboarding.
 *
 * MUST be called after the transaction commits, for two reasons — and the
 * ordering one is the real one:
 *
 * 1. The job runner can pick a `BackgroundJob` row up as soon as it is visible, so
 *    enqueueing pre-commit races the recompute against data that has not landed —
 *    it would recompute from the *old* department/location, which is the exact bug
 *    this fixes.
 * 2. `enqueue` must not be able to fail a write that already succeeded.
 *
 * Why it is needed at all: a reactivated employee keeps the
 * `RequirementsCacheEntry` rows from their old stint, computed against the old
 * dept/location. Nothing else fixes them — the nightly rebuild filters
 * `isActive: true`, so the stale rows survive offboarding and are still there when
 * the employee comes back. The invalidate handler wipes entries when it finds the
 * employee inactive, which is why offboarding enqueues this too: fixing only the
 * rehire end would paper over stale rows rather than clearing them.
 */
export async function enqueueRequirementsCacheInvalidate(
  employeeId: number,
): Promise<void> {
  try {
    await enqueue("REQUIREMENTS_CACHE_INVALIDATE", { employeeId });
  } catch (err) {
    console.error(
      `Failed to enqueue REQUIREMENTS_CACHE_INVALIDATE for employee ${employeeId}:`,
      err,
    );
  }
}
