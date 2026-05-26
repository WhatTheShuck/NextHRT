import prisma from "@/lib/prisma";
import { Category } from "@/generated/prisma_client/client";

interface CreateTrainingInput {
  title: string;
  category: Category;
}

class TrainingCourseRequestService {
  async submitCourseRequest(name: string, description: string | undefined, userId: string) {
    return prisma.trainingCourseRequest.create({
      data: { name, description, requestedByUserId: userId, status: "Pending" },
    });
  }

  async getCourseRequests(options?: { requestedByUserId?: string }) {
    return prisma.trainingCourseRequest.findMany({
      where: options?.requestedByUserId
        ? { requestedByUserId: options.requestedByUserId }
        : undefined,
      include: {
        requestedByUser: { select: { id: true, name: true } },
        resolvedTraining: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async resolveCourseRequest(
    id: number,
    decision: "Approved" | "Rejected",
    trainingData?: CreateTrainingInput,
  ) {
    const request = await prisma.trainingCourseRequest.findUnique({ where: { id } });
    if (!request) throw new Error("NOT_FOUND");

    if (decision === "Rejected") {
      return prisma.trainingCourseRequest.update({
        where: { id },
        data: { status: "Rejected" },
      });
    }

    if (!trainingData) throw new Error("TRAINING_DATA_REQUIRED");

    const training = await prisma.training.create({
      data: { title: trainingData.title, category: trainingData.category, isActive: true },
    });

    return prisma.trainingCourseRequest.update({
      where: { id },
      data: { status: "Approved", resolvedTrainingId: training.id },
    });
  }
}

export const trainingCourseRequestService = new TrainingCourseRequestService();
