import prisma from "@/lib/prisma";
import {
  EmployeeStatus,
  OnboardingStatus,
  Prisma,
} from "@/generated/prisma_client/client";
import { deriveEmploymentType } from "@/lib/employment";
import {
  duplicateSuggestions,
  findNameMatches,
} from "@/lib/services/employeeDuplicateService";
import {
  enqueueRequirementsCacheInvalidate,
  rehireInTx,
} from "@/lib/services/employeeRehire";

/**
 * Non-HR payload archived on the request as JSON (spec §6.3 / §5). These objects
 * are NOT part of the Admin's approval gate — they only drive downstream job
 * fan-out (Wave E / P10) and are surfaced read-only on the employee profile.
 *
 * Wave D (P8 form) builds against this shape, so keep it stable.
 */
export interface OnboardingProgramSelection {
  programId: number;
  // Reference user (employee) for programs that require one (e.g. SAP, C4C Service).
  referenceUserEmployeeId?: number | null;
}

export interface OnboardingHardwareSelection {
  hardwareItemId: number;
  nonStandard?: boolean;
  justification?: string | null;
  /** Tablet option: call & text (cellular) capability required. */
  callText?: boolean;
  /** Tablet option: a data SIM is required (site-going employees). */
  needsData?: boolean;
  /** The number decision for a SIM-bearing item (null when no SIM). */
  numberOption?: "NEW" | "REUSE" | "NONE" | null;
  /** When numberOption is REUSE: the HRT employee whose number is inherited. */
  reuseNumberFromEmployeeId?: number | null;
}

export interface OnboardingCompliance {
  letterOfOfferSigned?: boolean;
  employmentFormsRequired?: boolean;
  policeCheckRequired?: boolean;
  marketingInductionRequired?: boolean;
  willReceiveVehicle?: boolean;
  willDriveVehicle?: boolean;
  requiresLandline?: boolean;
}

export interface OnboardingNotes {
  it?: string | null;
  hr?: string | null;
  payroll?: string | null;
}

export interface OnboardingPayload {
  programs: OnboardingProgramSelection[];
  hardware: OnboardingHardwareSelection[];
  compliance: OnboardingCompliance;
  notes: OnboardingNotes;
}

/** Core HR fields the Admin reviews/edits → become the Employee on approval. */
export interface OnboardingCoreHRData {
  legalFirstName: string;
  legalLastName: string;
  preferredFirstName?: string | null;
  preferredLastName?: string | null;
  title: string;
  departmentId?: number | null;
  locationId?: number | null;
  employmentStatus: EmployeeStatus;
  startDate: string;
  managerEmployeeId?: number | null;
  jobFamilyId?: number | null;
  medicalStandardId?: number | null;
  emailConfirmed?: boolean;
}

export interface CreateOnboardingData extends OnboardingCoreHRData {
  payload: OnboardingPayload;
  pendingDepartmentRequestId?: number | null;
  pendingLocationRequestId?: number | null;
  /** Submitter's "this looks like a returning employee" hint. Advisory only. */
  possibleRehire?: boolean;
}

/**
 * How the Admin resolved the request at approval.
 *
 * `create` is the default so an approval that says nothing behaves as it always
 * has — but it is guarded: without `confirmDuplicate` it refuses to create over a
 * name match, mirroring `employeeService.createEmployee`. An unrecognised mode is
 * rejected outright rather than falling through to `create`, because a typo'd mode
 * silently creating the duplicate employee is the exact failure this exists to
 * prevent.
 *
 * There is deliberately no `startDate` here: the rehire start date travels in
 * `edits.startDate`, so the request row and the reactivated Employee cannot end up
 * disagreeing about when the new stint began.
 */
export interface RehireOptionalFields {
  jobFamilyId?: number | null;
  preferredFirstName?: string | null;
  preferredLastName?: string | null;
}

export type ApprovalDecision =
  | { mode: "create"; confirmDuplicate?: boolean }
  | {
      mode: "rehire";
      employeeId: number;
      priorFinishDate?: string | null;
      legalFirstName?: string;
      legalLastName?: string;
      optionalFields?: RehireOptionalFields;
    };

export interface ListOnboardingOptions {
  status?: OnboardingStatus;
  createdEmployeeId?: number;
}

const requestInclude = {
  submittedByUser: { select: { id: true, name: true, email: true } },
  jobFamily: true,
  medicalStandard: true,
  pendingDepartmentRequest: {
    select: { id: true, type: true, requestedData: true, status: true, requestedByUser: { select: { id: true, name: true, email: true } } },
  },
  pendingLocationRequest: {
    select: { id: true, type: true, requestedData: true, status: true, requestedByUser: { select: { id: true, name: true, email: true } } },
  },
} satisfies Prisma.OnboardingRequestInclude;

function emptyPayload(): OnboardingPayload {
  return { programs: [], hardware: [], compliance: {}, notes: {} };
}

export class OnboardingService {
  /**
   * Create a pending onboarding request (does NOT create an Employee — that
   * happens on Admin approval, §6.3). Auth: any authenticated manager.
   */
  async createRequest(data: CreateOnboardingData, userId: string) {
    const employmentType = deriveEmploymentType(data.employmentStatus);

    const request = await prisma.onboardingRequest.create({
      data: {
        status: "Pending",
        submittedByUser: { connect: { id: userId } },
        legalFirstName: data.legalFirstName,
        legalLastName: data.legalLastName,
        preferredFirstName: data.preferredFirstName ?? null,
        preferredLastName: data.preferredLastName ?? null,
        title: data.title,
        departmentId: data.departmentId ?? null,
        locationId: data.locationId ?? null,
        pendingDepartmentRequest: data.pendingDepartmentRequestId
          ? { connect: { id: data.pendingDepartmentRequestId } }
          : undefined,
        pendingLocationRequest: data.pendingLocationRequestId
          ? { connect: { id: data.pendingLocationRequestId } }
          : undefined,
        employmentStatus: data.employmentStatus,
        employmentType,
        startDate: new Date(data.startDate),
        managerEmployeeId: data.managerEmployeeId ?? null,
        jobFamily: data.jobFamilyId
          ? { connect: { id: data.jobFamilyId } }
          : undefined,
        medicalStandard: data.medicalStandardId
          ? { connect: { id: data.medicalStandardId } }
          : undefined,
        emailConfirmed: data.emailConfirmed ?? false,
        // `=== true` because POST /api/onboarding hands request.json() straight
        // through with no validation, and a non-boolean here would 500 the
        // submission on a purely advisory field.
        possibleRehire: data.possibleRehire === true,
        payload: JSON.stringify(data.payload ?? emptyPayload()),
      },
      include: requestInclude,
    });

    await prisma.history.create({
      data: {
        tableName: "OnboardingRequest",
        recordId: request.id.toString(),
        action: "CREATE",
        newValues: JSON.stringify(request),
        userId,
      },
    });

    return request;
  }

  async listRequests(options: ListOnboardingOptions = {}) {
    return prisma.onboardingRequest.findMany({
      where: {
        ...(options.status ? { status: options.status } : {}),
        ...(options.createdEmployeeId !== undefined
          ? { createdEmployeeId: options.createdEmployeeId }
          : {}),
      },
      include: requestInclude,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });
  }

  async getRequestById(id: number) {
    const request = await prisma.onboardingRequest.findUnique({
      where: { id },
      include: requestInclude,
    });

    if (!request) {
      throw new Error("ONBOARDING_REQUEST_NOT_FOUND");
    }

    return request;
  }

  /** Parsed payload for a request, tolerant of malformed/missing JSON. */
  parsePayload(request: { payload: string }): OnboardingPayload {
    try {
      const parsed = JSON.parse(request.payload) as Partial<OnboardingPayload>;
      return {
        programs: parsed.programs ?? [],
        hardware: parsed.hardware ?? [],
        compliance: parsed.compliance ?? {},
        notes: parsed.notes ?? {},
      };
    } catch {
      return emptyPayload();
    }
  }

  /**
   * Approve a pending request. In one transaction: optionally apply the Admin's
   * edits to the core HR fields, then either create the Employee (NO User — §6.3)
   * or reactivate a departed one as a rehire, and flip the request to Approved with
   * the resulting employee linked. History logged for the Employee (CREATE or
   * REHIRE) and the request (UPDATE).
   *
   * Downstream job fan-out (Wave E / P10) hangs off this approval; it is NOT
   * wired here. A rehire gets the identical new-starter fan-out, which is
   * deliberate — a returning employee genuinely needs new hardware, re-granted
   * program access and forms re-signed. If the *wording* turns out to matter, the
   * fix is rehire variants of the affected templates, not suppressing sections.
   */
  async approveRequest(
    id: number,
    userId: string,
    edits?: Partial<OnboardingCoreHRData>,
    decision: ApprovalDecision = { mode: "create" },
  ) {
    const result = await prisma.$transaction(async (tx) => {
      const request = await tx.onboardingRequest.findUnique({ where: { id } });

      if (!request) {
        throw new Error("ONBOARDING_REQUEST_NOT_FOUND");
      }
      if (request.status !== "Pending") {
        throw new Error("ONBOARDING_REQUEST_NOT_PENDING");
      }
      if (request.pendingDepartmentRequestId != null || request.pendingLocationRequestId != null) {
        throw new Error("ONBOARDING_HAS_PENDING_ORG_REQUESTS");
      }

      // Merge the Admin's edits over the submitted core HR fields.
      const employmentStatus = (edits?.employmentStatus ??
        request.employmentStatus) as EmployeeStatus;
      const legalFirstName = edits?.legalFirstName ?? request.legalFirstName;
      const legalLastName = edits?.legalLastName ?? request.legalLastName;
      const preferredFirstName =
        edits?.preferredFirstName !== undefined
          ? edits.preferredFirstName
          : request.preferredFirstName;
      const preferredLastName =
        edits?.preferredLastName !== undefined
          ? edits.preferredLastName
          : request.preferredLastName;
      const title = edits?.title ?? request.title;
      const departmentId = edits?.departmentId ?? request.departmentId;
      const locationId = edits?.locationId ?? request.locationId;
      if (!departmentId || !locationId) {
        throw new Error("ONBOARDING_MISSING_DEPT_OR_LOCATION");
      }
      const startDate = edits?.startDate
        ? new Date(edits.startDate)
        : request.startDate;
      const jobFamilyId =
        edits?.jobFamilyId !== undefined
          ? edits.jobFamilyId
          : request.jobFamilyId;
      const employmentType = deriveEmploymentType(employmentStatus);

      if (decision.mode !== "create" && decision.mode !== "rehire") {
        // Never fall through to `create` — a typo'd mode silently creating the
        // duplicate employee is the exact failure this feature prevents.
        throw new Error("INVALID_APPROVAL_DECISION");
      }

      let employee;

      if (decision.mode === "rehire") {
        employee = await rehireInTx(
          tx,
          decision.employeeId,
          {
            startDate,
            priorFinishDate: decision.priorFinishDate,
            title,
            departmentId,
            locationId,
            status: employmentStatus,
            // The request has no usi/notes columns, so those are left as the prior
            // record holds them (undefined = don't touch).
            jobFamilyId: decision.optionalFields?.jobFamilyId,
            preferredFirstName: decision.optionalFields?.preferredFirstName,
            preferredLastName: decision.optionalFields?.preferredLastName,
            legalFirstName: decision.legalFirstName,
            legalLastName: decision.legalLastName,
          },
          userId,
        );
      } else {
        // Refuse to create over a name match unless the Admin said so explicitly.
        // Without this the guarantee would be a button in one React component:
        // any other caller, or a replayed request, creates the duplicate row.
        // `!== true`, not falsy: a junk value from an unvalidated caller must fail
        // closed into the guard rather than truthily past it.
        if (decision.confirmDuplicate !== true) {
          const matches = await findNameMatches(
            legalFirstName,
            legalLastName,
            tx,
          );
          if (matches.length > 0) {
            throw {
              code: "DUPLICATE_EMPLOYEE",
              matches,
              suggestions: duplicateSuggestions(matches),
            };
          }
        }

        // Create the Employee (no User) — mirrors employeeService.createEmployee
        // field mapping; preferred defaults to legal.
        employee = await tx.employee.create({
          data: {
            legalFirstName,
            legalLastName,
            preferredFirstName: preferredFirstName ?? legalFirstName,
            preferredLastName: preferredLastName ?? legalLastName,
            title,
            startDate,
            department: { connect: { id: departmentId } },
            location: { connect: { id: locationId } },
            status: employmentStatus,
            isActive: true,
            employmentType,
            jobFamily: jobFamilyId ? { connect: { id: jobFamilyId } } : undefined,
          },
          include: { department: true, location: true },
        });

        await tx.history.create({
          data: {
            tableName: "Employee",
            recordId: employee.id.toString(),
            action: "CREATE",
            newValues: JSON.stringify(employee),
            userId,
          },
        });
      }

      const updated = await tx.onboardingRequest.update({
        where: { id },
        data: {
          status: "Approved",
          // Populated on both paths — on a rehire this is the reactivated
          // employee's id, so the profile's onboarding tab keeps working unchanged
          // and a returning employee shows both their original and their rehire
          // request (the column is not unique).
          createdEmployeeId: employee.id,
          rehireOfEmployeeId:
            decision.mode === "rehire" ? decision.employeeId : null,
          reviewedByUserId: userId,
          reviewedAt: new Date(),
          // Persist the (possibly edited) core HR fields back onto the request
          // so the stored request reflects exactly what was approved.
          //
          // Legal names come off the resulting employee, not the merge: in rehire
          // mode the Admin may have chosen to keep the existing record's names, and
          // writing the merged values here would leave the request and the Employee
          // disagreeing about the person's legal name.
          legalFirstName: employee.legalFirstName,
          legalLastName: employee.legalLastName,
          preferredFirstName,
          preferredLastName,
          title,
          departmentId,
          locationId,
          employmentStatus,
          employmentType,
          startDate,
          jobFamilyId,
          medicalStandardId:
            edits?.medicalStandardId !== undefined
              ? edits.medicalStandardId
              : request.medicalStandardId,
        },
        include: requestInclude,
      });

      await tx.history.create({
        data: {
          tableName: "OnboardingRequest",
          recordId: id.toString(),
          action: "UPDATE",
          oldValues: JSON.stringify(request),
          newValues: JSON.stringify(updated),
          userId,
        },
      });

      return { request: updated, employee };
    });

    if (decision.mode === "rehire") {
      // Post-commit: the job runner can pick the row up as soon as it is visible,
      // so enqueueing inside the transaction would race the recompute against the
      // old dept/location — the exact staleness this fixes.
      await enqueueRequirementsCacheInvalidate(result.employee.id);
    }

    return result;
  }

  /** Reject a pending request with a reason. No Employee is created. */
  async rejectRequest(id: number, userId: string, reviewNotes?: string | null) {
    const request = await prisma.onboardingRequest.findUnique({ where: { id } });

    if (!request) {
      throw new Error("ONBOARDING_REQUEST_NOT_FOUND");
    }
    if (request.status !== "Pending") {
      throw new Error("ONBOARDING_REQUEST_NOT_PENDING");
    }

    const updated = await prisma.onboardingRequest.update({
      where: { id },
      data: {
        status: "Rejected",
        reviewedByUserId: userId,
        reviewedAt: new Date(),
        reviewNotes: reviewNotes ?? null,
      },
      include: requestInclude,
    });

    await prisma.history.create({
      data: {
        tableName: "OnboardingRequest",
        recordId: id.toString(),
        action: "UPDATE",
        oldValues: JSON.stringify(request),
        newValues: JSON.stringify(updated),
        userId,
      },
    });

    return updated;
  }

  async getPendingCount(): Promise<number> {
    return prisma.onboardingRequest.count({ where: { status: "Pending" } });
  }
}

export const onboardingService = new OnboardingService();
