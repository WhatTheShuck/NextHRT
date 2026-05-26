import prisma from "@/lib/prisma";
import { auth } from "../auth";
import { logService } from "./logService";
import {
  Prisma,
  ApprovalRequestType,
  ApprovalDecision,
  ApprovalStage,
} from "@/generated/prisma_client/client";

const STAGE_ORDER: ApprovalStage[] = ["DepartmentManager", "HRManager", "Admin"];

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

    const actor = await prisma.user.findUnique({ where: { id: userId } });

    // Compute onBehalfOf
    const onBehalfOf =
      request.nominatedApproverEmployeeId !== null &&
      (actor?.employeeId == null ||
        actor.employeeId !== request.nominatedApproverEmployeeId);

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

  async getPendingRequestsForUser(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { managedDepartments: { include: { childDepartments: true } } },
    });
    if (!user) return [];

    const userRole = user.role ?? "User";

    const [canApproveAsHR, canAdminApprove] = await Promise.all([
      auth.api.userHasPermission({
        body: { role: userRole, permissions: { trainingRequest: ["approveAsHR"] } },
      }),
      auth.api.userHasPermission({
        body: { role: userRole, permissions: { trainingRequest: ["adminApprove"] } },
      }),
    ]);

    // Admins (adminApprove) can see all pending requests regardless of stage or department.
    if (canAdminApprove?.success) {
      return prisma.approvalRequest.findMany({
        where: { status: "Pending" },
        include: {
          actions: { include: { user: { select: { id: true, name: true } } } },
          trainingRequest: {
            include: {
              employee: { select: { id: true, firstName: true, lastName: true } },
              training: { select: { id: true, title: true } },
              trainingCourseRequest: { select: { id: true, name: true } },
            },
          },
          nominatedApproverEmployee: { select: { id: true, firstName: true, lastName: true } },
          submittedByUser: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "asc" },
      });
    }

    const managedDeptIds = user.managedDepartments.map((d) => d.id);
    if (user.canManageChildrenDepartments) {
      user.managedDepartments.forEach((d) =>
        d.childDepartments.forEach((c) => managedDeptIds.push(c.id)),
      );
    }

    // Build OR clauses for non-admin approvers.
    const orClauses: Prisma.ApprovalRequestWhereInput[] = [];

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
    if (orClauses.length === 0) return [];

    return prisma.approvalRequest.findMany({
      where: { status: "Pending", OR: orClauses },
      include: {
        actions: { include: { user: { select: { id: true, name: true } } } },
        trainingRequest: {
          include: {
            employee: { select: { id: true, firstName: true, lastName: true } },
            training: { select: { id: true, title: true } },
            trainingCourseRequest: { select: { id: true, name: true } },
          },
        },
        nominatedApproverEmployee: { select: { id: true, firstName: true, lastName: true } },
        submittedByUser: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
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

    for (const request of pending) {
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
