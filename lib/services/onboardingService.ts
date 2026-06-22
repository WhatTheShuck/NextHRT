import prisma from "@/lib/prisma";
import {
  EmployeeStatus,
  OnboardingStatus,
  Prisma,
} from "@/generated/prisma_client/client";
import { deriveEmploymentType } from "@/lib/employment";

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
}

export interface OnboardingCompliance {
  letterOfOfferSigned?: boolean;
  employmentFormsRequired?: boolean;
  policeCheckRequired?: boolean;
  marketingInductionRequired?: boolean;
  willReceiveVehicle?: boolean;
  willDriveVehicle?: boolean;
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
  departmentId: number;
  locationId: number;
  employmentStatus: EmployeeStatus;
  startDate: string;
  managerEmployeeId?: number | null;
  jobFamilyId?: number | null;
  medicalStandardId?: number | null;
  emailConfirmed?: boolean;
}

export interface CreateOnboardingData extends OnboardingCoreHRData {
  payload: OnboardingPayload;
}

export interface ListOnboardingOptions {
  status?: OnboardingStatus;
  createdEmployeeId?: number;
}

// OnboardingRequest stores departmentId/locationId as plain scalars (no relation
// — they're snapshotted on the request), so only the true relations are included.
const requestInclude = {
  submittedByUser: { select: { id: true, name: true, email: true } },
  jobFamily: true,
  medicalStandard: true,
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
        departmentId: data.departmentId,
        locationId: data.locationId,
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
   * edits to the core HR fields, create the Employee (NO User — §6.3), and flip
   * the request to Approved with the created employee linked. History logged for
   * both the Employee (CREATE) and the request (UPDATE).
   *
   * Downstream job fan-out (Wave E / P10) hangs off this approval; it is NOT
   * wired here.
   */
  async approveRequest(
    id: number,
    userId: string,
    edits?: Partial<OnboardingCoreHRData>,
  ) {
    return prisma.$transaction(async (tx) => {
      const request = await tx.onboardingRequest.findUnique({ where: { id } });

      if (!request) {
        throw new Error("ONBOARDING_REQUEST_NOT_FOUND");
      }
      if (request.status !== "Pending") {
        throw new Error("ONBOARDING_REQUEST_NOT_PENDING");
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
      const startDate = edits?.startDate
        ? new Date(edits.startDate)
        : request.startDate;
      const jobFamilyId =
        edits?.jobFamilyId !== undefined
          ? edits.jobFamilyId
          : request.jobFamilyId;
      const employmentType = deriveEmploymentType(employmentStatus);

      // Create the Employee (no User) — mirrors employeeService.createEmployee
      // field mapping; preferred defaults to legal.
      const employee = await tx.employee.create({
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

      const updated = await tx.onboardingRequest.update({
        where: { id },
        data: {
          status: "Approved",
          createdEmployeeId: employee.id,
          reviewedByUserId: userId,
          reviewedAt: new Date(),
          // Persist the (possibly edited) core HR fields back onto the request
          // so the stored request reflects exactly what was approved.
          legalFirstName,
          legalLastName,
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
}

export const onboardingService = new OnboardingService();
