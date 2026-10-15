import prisma from "@/lib/prisma";
import { auth } from "../auth";
import { logService } from "./logService";
import { getApprovableForUser, getApproversFor, getAuthorityMode } from "./authorityService";
import {
  Prisma,
  ApprovalRequestType,
  ApprovalDecision,
  ApprovalStage,
} from "@/generated/prisma_client/client";

const STAGE_ORDER: ApprovalStage[] = ["DepartmentManager", "HRManager", "Admin"];

type ApproverUser = Prisma.UserGetPayload<{
  include: { managedDepartments: { include: { childDepartments: true } } };
}>;

const nameSelect = { select: { id: true, legalFirstName: true, legalLastName: true, preferredFirstName: true, preferredLastName: true } };

/**
 * Deciding on someone else's behalf needs a comment whichever way it goes: an
 * admin stepping in from outside the line, or anyone other than the approver
 * the requester nominated.
 */
export function decidesOnBehalf(
  adminSteppingIn: boolean,
  nominatedApproverEmployeeId: number | null,
  actorEmployeeId: number | null,
): boolean {
  return (
    adminSteppingIn ||
    (nominatedApproverEmployeeId !== null && actorEmployeeId !== nominatedApproverEmployeeId)
  );
}

const pendingRequestInclude = {
  actions: { include: { user: { select: { id: true, name: true } }, actingFor: nameSelect } },
  trainingRequest: {
    include: {
      employee: { select: { id: true, legalFirstName: true, legalLastName: true } },
      training: { select: { id: true, title: true } },
      trainingCourseRequest: { select: { id: true, name: true } },
    },
  },
  nominatedApproverEmployee: { select: { id: true, legalFirstName: true, legalLastName: true } },
  submittedByUser: { select: { id: true, name: true } },
} satisfies Prisma.ApprovalRequestInclude;

class ApprovalService {
  async createRequest(options: {
    requestType: ApprovalRequestType;
    nominatedApproverEmployeeId?: number;
    submittedByUserId: string;
    tx?: Prisma.TransactionClient;
  }) {
    const client = options.tx ?? prisma;
    return client.approvalRequest.create({
      data: {
        requestType: options.requestType,
        status: "Pending",
        currentStage: "DepartmentManager",
        nominatedApproverEmployeeId: options.nominatedApproverEmployeeId ?? null,
        submittedByUserId: options.submittedByUserId,
      },
    });
  }

  async recordDecision(options: {
    requestId: number;
    userId: string;
    decision: ApprovalDecision;
    comment?: string;
  }) {
    const { requestId, userId, decision, comment } = options;

    const request = await prisma.approvalRequest.findUnique({
      where: { id: requestId },
      include: { trainingRequest: true },
    });
    if (!request) throw new Error("REQUEST_NOT_FOUND");
    if (request.status !== "Pending") throw new Error("REQUEST_NOT_PENDING");

    const actor = await prisma.user.findUnique({
      where: { id: userId },
      include: { managedDepartments: { include: { childDepartments: true } } },
    });
    if (!actor) throw new Error("NOT_AUTHORISED");

    // Nobody decides a request about themselves, admins included.
    if (actor.employeeId != null && actor.employeeId === request.trainingRequest?.employeeId) {
      throw new Error("SELF_APPROVAL");
    }

    // Deciding is allowed on exactly what the approvals list shows this user.
    const decidable = await this.decidableFilter(actor);
    if (!decidable) throw new Error("NOT_AUTHORISED");
    const allowed = await prisma.approvalRequest.count({
      where: { AND: [{ id: requestId }, decidable] },
    });
    if (allowed === 0) throw new Error("NOT_AUTHORISED");

    // Line-manager authority, manager stage (spec §9.2): a delegate decides at the level of the
    // manager they act for (recorded, no comment needed); anyone else here is an admin
    // stepping in, which goes through the on-behalf-of path and needs a comment.
    const approvable = request.currentStage === "DepartmentManager" ? await getApprovableForUser(userId) : null;
    const subjectId = request.trainingRequest?.employeeId ?? null;
    const inLine = approvable !== null && subjectId !== null && approvable.has(subjectId);
    const actingForEmployeeId = inLine ? (approvable.get(subjectId!) ?? null) : null;
    const adminSteppingIn = approvable !== null && !inLine;

    const onBehalfOf = decidesOnBehalf(adminSteppingIn, request.nominatedApproverEmployeeId, actor.employeeId);

    // Validate comment requirements (must happen before any write)
    if ((onBehalfOf || decision === "Rejected") && !comment) {
      throw new Error("COMMENT_REQUIRED");
    }

    // Write action
    await prisma.approvalAction.create({
      data: {
        requestId,
        stage: request.currentStage,
        userId,
        decision,
        comment: comment ?? null,
        onBehalfOf,
        actingForEmployeeId,
      },
    });

    // Update request state
    if (decision === "Rejected") {
      await prisma.approvalRequest.update({
        where: { id: requestId },
        data: { status: "Rejected" },
      });
    } else {
      const currentIdx = STAGE_ORDER.indexOf(request.currentStage);
      const nextStage = STAGE_ORDER[currentIdx + 1];

      if (nextStage) {
        await prisma.approvalRequest.update({
          where: { id: requestId },
          data: { currentStage: nextStage },
        });
      } else {
        // Final stage approved
        await prisma.approvalRequest.update({
          where: { id: requestId },
          data: { status: "Approved" },
        });
      }
    }

    return prisma.approvalRequest.findUnique({
      where: { id: requestId },
      include: {
        actions: true,
        trainingRequest: true, // required: decision route reads trainingRequest.id to call finaliseApproval
      },
    });
  }

  /**
   * The pending-request filter for what `user` may decide, or null when they have no approval
   * access. Shared by the approvals list and `recordDecision`, so being able to see a request
   * and being able to decide it can't drift apart.
   */
  private async decidableFilter(user: ApproverUser): Promise<Prisma.ApprovalRequestWhereInput | null> {
    const userRole = user.role ?? "User";

    const [canApproveAsHR, canAdminApprove] = await Promise.all([
      auth.api.userHasPermission({
        body: { role: userRole, permissions: { trainingRequest: ["approveAsHR"] } },
      }),
      auth.api.userHasPermission({
        body: { role: userRole, permissions: { trainingRequest: ["adminApprove"] } },
      }),
    ]);

    // Never offer a user a request about themselves.
    const notOwn: Prisma.ApprovalRequestWhereInput =
      user.employeeId != null ? { NOT: { trainingRequest: { employeeId: user.employeeId } } } : {};

    // Admins (adminApprove) can act on all pending requests regardless of stage or department.
    if (canAdminApprove?.success) return { status: "Pending", ...notOwn };

    // Build OR clauses for non-admin approvers.
    const orClauses: Prisma.ApprovalRequestWhereInput[] = [];

    // Line-manager authority: direct manager and one up, delegates as the manager they act for.
    const approvable = await getApprovableForUser(user.id);
    if (approvable) {
      if (approvable.size > 0) {
        orClauses.push({
          currentStage: ApprovalStage.DepartmentManager,
          trainingRequest: { employeeId: { in: [...approvable.keys()] } },
        });
      }
    }

    const managedDeptIds = approvable ? [] : user.managedDepartments.map((d) => d.id);
    if (!approvable && user.canManageChildrenDepartments) {
      user.managedDepartments.forEach((d) =>
        d.childDepartments.forEach((c) => managedDeptIds.push(c.id)),
      );
    }

    if (managedDeptIds.length > 0) {
      orClauses.push({
        currentStage: ApprovalStage.DepartmentManager,
        trainingRequest: { employee: { departmentId: { in: managedDeptIds } } },
      });
    }

    if (canApproveAsHR?.success) {
      orClauses.push({ currentStage: ApprovalStage.HRManager });
    }

    // No matching clauses — user has no approval access.
    if (orClauses.length === 0) return null;

    return { status: "Pending", OR: orClauses, ...notOwn };
  }

  async getPendingRequestsForUser(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { managedDepartments: { include: { childDepartments: true } } },
    });
    if (!user) return [];

    const where = await this.decidableFilter(user);
    if (!where) return [];

    const requests = await prisma.approvalRequest.findMany({
      where,
      include: pendingRequestInclude,
      orderBy: { createdAt: "asc" },
    });

    // Line-manager authority: tell the approver whose behalf they act on at the manager stage.
    // onBehalfOf: the decision needs a comment whichever way it goes (see decide).
    const approvable = await getApprovableForUser(userId);
    if (!approvable) {
      return requests.map((r) => ({
        ...r,
        actingFor: null,
        adminSteppingIn: false,
        onBehalfOf: decidesOnBehalf(false, r.nominatedApproverEmployeeId, user.employeeId),
      }));
    }
    const actingForIds = [...new Set([...approvable.values()].filter((v): v is number => v !== null))];
    const names = new Map(
      (await prisma.employee.findMany({ where: { id: { in: actingForIds } }, ...nameSelect })).map((e) => [
        e.id,
        `${e.preferredFirstName || e.legalFirstName} ${e.preferredLastName || e.legalLastName}`,
      ]),
    );
    return requests.map((r) => {
      const subjectId = r.trainingRequest?.employeeId;
      const managerStage = r.currentStage === "DepartmentManager";
      const inLine = subjectId !== undefined && approvable.has(subjectId);
      const actingForId = inLine ? approvable.get(subjectId!) ?? null : null;
      const adminSteppingIn = managerStage && !inLine;
      return {
        ...r,
        actingFor: managerStage && actingForId !== null ? { id: actingForId, name: names.get(actingForId) ?? "" } : null,
        adminSteppingIn,
        onBehalfOf: decidesOnBehalf(adminSteppingIn, r.nominatedApproverEmployeeId, user.employeeId),
      };
    });
  }

  async getPendingCountForUser(userId: string): Promise<number> {
    const requests = await this.getPendingRequestsForUser(userId);
    return requests.length;
  }

  async reevaluatePendingRequests(): Promise<void> {
    const pending = await prisma.approvalRequest.findMany({
      where: { status: "Pending" },
      include: {
        trainingRequest: { include: { employee: { select: { departmentId: true } } } },
      },
    });

    const lineMode = (await getAuthorityMode()) === "lineManager";
    for (const request of pending) {
      if (lineMode && request.currentStage === "DepartmentManager") {
        const subjectId = request.trainingRequest?.employeeId;
        if (!subjectId) continue;
        const approvers = await getApproversFor(subjectId);
        const withAccount = await prisma.user.count({
          where: { employeeId: { in: approvers.map((a) => a.employeeId) } },
        });
        if (withAccount === 0) {
          await logService.log(
            `Approval request #${request.id} (${request.requestType}) has no line manager with an HRT account who can approve it. An admin can step in, or set the employee's Reports To.`,
            "Warning",
            "REEVALUATE_PENDING_APPROVALS",
          );
        }
        continue;
      }
      if (request.currentStage === "DepartmentManager") {
        const deptId = request.trainingRequest?.employee?.departmentId;
        if (!deptId) continue;

        const dms = await prisma.user.findMany({
          where: {
            role: "DepartmentManager",
            managedDepartments: { some: { id: deptId } },
          },
          select: { id: true },
        });

        if (dms.length === 0) {
          await logService.log(
            `Approval request #${request.id} (${request.requestType}) has no eligible approvers at stage ${request.currentStage}. Check department manager assignments.`,
            "Warning",
            "REEVALUATE_PENDING_APPROVALS",
          );
        }
      }
    }
  }
}

export const approvalService = new ApprovalService();
