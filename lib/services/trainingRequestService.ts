import prisma from "@/lib/prisma";
import { approvalService } from "./approvalService";

interface CreateTrainingRequestInput {
  employeeId: number;
  submittedByUserId: string;
  trainingId: number | null;
  trainingCourseRequestId: number | null;
  nominatedApproverEmployeeId?: number;
  justification?: string;
  cost?: number;
  hours?: number;
  trainingDate?: Date;
  intendedCompletionDate?: Date;
}

class TrainingRequestService {
  async createTrainingRequest(data: CreateTrainingRequestInput) {
    if (!data.trainingId && !data.trainingCourseRequestId) {
      throw new Error("INVALID_REQUEST");
    }

    // Use a transaction so an orphaned ApprovalRequest is never left if TrainingRequest creation fails.
    return prisma.$transaction(async (tx) => {
      const approvalRequest = await approvalService.createRequest({
        requestType: "Training",
        nominatedApproverEmployeeId: data.nominatedApproverEmployeeId,
        submittedByUserId: data.submittedByUserId,
        tx, // enroll in transaction
      });

      const trainingRequest = await tx.trainingRequest.create({
        data: {
          approvalRequestId: approvalRequest.id,
          employeeId: data.employeeId,
          trainingId: data.trainingId ?? null,
          trainingCourseRequestId: data.trainingCourseRequestId ?? null,
          justification: data.justification,
          cost: data.cost,
          hours: data.hours,
          trainingDate: data.trainingDate,
          intendedCompletionDate: data.intendedCompletionDate,
        },
      });

      return { trainingRequest, approvalRequest };
    });
  }

  async finaliseApproval(trainingRequestId: number) {
    const tr = await prisma.trainingRequest.findUnique({
      where: { id: trainingRequestId },
      include: { approvalRequest: { include: { submittedByUser: true } } },
    });
    if (!tr) throw new Error("NOT_FOUND");
    if (!tr.trainingId) throw new Error("COURSE_REQUEST_UNRESOLVED");

    return prisma.trainingRecords.create({
      data: {
        employeeId: tr.employeeId,
        trainingId: tr.trainingId,
        trainer: tr.approvalRequest.submittedByUser.name ?? "Unknown",
        dateCompleted: tr.trainingDate ?? new Date(),
      },
    });
  }

  async getTrainingRequestDetails(id: number) {
    return prisma.trainingRequest.findUnique({
      where: { id },
      include: {
        approvalRequest: {
          include: {
            actions: {
              include: { user: { select: { id: true, name: true } } },
              orderBy: { createdAt: "asc" },
            },
            submittedByUser: { select: { id: true, name: true } },
            nominatedApproverEmployee: { select: { id: true, legalFirstName: true, legalLastName: true } },
          },
        },
        employee: { select: { id: true, legalFirstName: true, legalLastName: true } },
        training: { select: { id: true, title: true } },
        trainingCourseRequest: { select: { id: true, name: true, status: true } },
      },
    });
  }

  async getRequestsForUser(userId: string, employeeId?: number) {
    return prisma.trainingRequest.findMany({
      where: employeeId != null
        ? {
            OR: [
              { approvalRequest: { submittedByUserId: userId } },
              { employeeId },
            ],
          }
        : { approvalRequest: { submittedByUserId: userId } },
      include: {
        approvalRequest: {
          select: {
            id: true,
            status: true,
            currentStage: true,
            createdAt: true,
            submittedByUserId: true,
            submittedByUser: { select: { id: true, name: true } },
          },
        },
        employee: { select: { id: true, legalFirstName: true, legalLastName: true } },
        training: { select: { id: true, title: true } },
        trainingCourseRequest: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }
}

export const trainingRequestService = new TrainingRequestService();
