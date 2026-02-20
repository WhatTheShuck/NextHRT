import prisma from "@/lib/prisma";
import { UserRole } from "@/generated/prisma_client";
import { fileUploadService } from "./fileUploadService";
import { auth } from "../auth";
import { getChildDepartmentIds } from "@/lib/apiRBAC";

export interface GetTrainingRecordsOptions {
  activeOnly?: boolean;
  userRole: UserRole;
  userId: string;
}

export class TrainingRecordService {
  async getTrainingRecords(options: GetTrainingRecordsOptions) {
    const { activeOnly, userRole, userId } = options;

    const whereClause: any = {};
    if (activeOnly) {
      whereClause.training = {
        isActive: true,
      };
    }

    const includeClause = {
      personTrained: {
        include: {
          department: true,
          location: true,
        },
      },
      training: true,
      images: true,
    };

    const canViewAll = await auth.api.userHasPermission({
      body: { role: userRole, permissions: { employee: ["viewAll"] } },
    });

    if (canViewAll) {
      return await prisma.trainingRecords.findMany({
        where: whereClause,
        include: includeClause,
        orderBy: {
          dateCompleted: "desc" as const,
        },
      });
    }

    const canViewDepartment = await auth.api.userHasPermission({
      body: { role: userRole, permissions: { employee: ["viewDepartment"] } },
    });

    if (canViewDepartment) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { managedDepartments: true },
      });

      if (!user) {
        throw new Error("USER_NOT_FOUND");
      }

      const departmentIds = user.managedDepartments.map((dept) => dept.id);

      // Expand parent departments to include their children
      const childDeptPromises = user.managedDepartments
        .filter((dept) => dept.level === 0)
        .map((dept) => getChildDepartmentIds(dept.id));
      const childDeptIdsArrays = await Promise.all(childDeptPromises);
      departmentIds.push(...childDeptIdsArrays.flat());

      const employees = await prisma.employee.findMany({
        where: { departmentId: { in: departmentIds } },
        select: { id: true },
      });
      const employeeIds = employees.map((emp) => emp.id);

      return await prisma.trainingRecords.findMany({
        where: {
          employeeId: { in: employeeIds },
          ...whereClause,
        },
        include: includeClause,
        orderBy: {
          dateCompleted: "desc" as const,
        },
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { employee: true },
    });

    if (!user || !user.employee) {
      throw new Error("NO_EMPLOYEE_RECORD");
    }

    return await prisma.trainingRecords.findMany({
      where: {
        employeeId: user.employee.id,
        ...whereClause,
      },
      include: includeClause,
      orderBy: {
        dateCompleted: "desc" as const,
      },
    });
  }

  async getTrainingRecordById(id: number) {
    const trainingRecord = await prisma.trainingRecords.findUnique({
      where: { id },
      include: {
        personTrained: {
          include: {
            department: true,
            location: true,
          },
        },
        training: true,
        images: true,
      },
    });

    if (!trainingRecord) {
      throw new Error("TRAINING_RECORD_NOT_FOUND");
    }

    return trainingRecord;
  }

  async createTrainingRecord(
    data: {
      employeeId: number;
      trainingId: number;
      dateCompleted: string;
      trainer: string;
    },
    images: File[],
    userId: string,
  ) {
    if (
      !data.employeeId ||
      !data.trainingId ||
      !data.dateCompleted ||
      !data.trainer
    ) {
      throw new Error("MISSING_REQUIRED_FIELDS");
    }

    const completedDate = new Date(data.dateCompleted);

    const existingRecord = await prisma.trainingRecords.findFirst({
      where: {
        employeeId: data.employeeId,
        trainingId: data.trainingId,
        dateCompleted: completedDate,
      },
    });

    if (existingRecord) {
      throw new Error("DUPLICATE_TRAINING_RECORD");
    }

    const training = await prisma.training.findUnique({
      where: { id: data.trainingId },
    });

    if (!training) {
      throw new Error("TRAINING_NOT_FOUND");
    }

    const savedImages = await fileUploadService.saveFiles(images, "training");

    const trainingRecord = await prisma.trainingRecords.create({
      data: {
        employeeId: data.employeeId,
        trainingId: data.trainingId,
        dateCompleted: completedDate,
        trainer: data.trainer,
        images: {
          create: savedImages.map((img) => ({
            imagePath: img.imagePath,
            imageType: img.imageType,
            originalName: img.originalName,
          })),
        },
      },
      include: {
        personTrained: {
          include: {
            department: true,
            location: true,
          },
        },
        training: true,
        images: true,
      },
    });

    await prisma.history.create({
      data: {
        tableName: "TrainingRecords",
        recordId: trainingRecord.id.toString(),
        action: "CREATE",
        newValues: JSON.stringify(trainingRecord),
        userId,
      },
    });

    return trainingRecord;
  }

  async updateTrainingRecord(
    id: number,
    data: {
      employeeId: number;
      trainingId: number;
      dateCompleted: string;
      trainer: string;
      removedImageIds?: number[];
    },
    images: File[],
    userId: string,
  ) {
    const currentRecord = await prisma.trainingRecords.findUnique({
      where: { id },
      include: { images: true },
    });

    if (!currentRecord) {
      throw new Error("TRAINING_RECORD_NOT_FOUND");
    }

    if (
      !data.employeeId ||
      !data.trainingId ||
      !data.dateCompleted ||
      !data.trainer
    ) {
      throw new Error("MISSING_REQUIRED_FIELDS");
    }

    const completedDate = new Date(data.dateCompleted);

    const training = await prisma.training.findUnique({
      where: { id: data.trainingId },
    });

    if (!training) {
      throw new Error("TRAINING_NOT_FOUND");
    }

    const existingRecord = await prisma.trainingRecords.findFirst({
      where: {
        employeeId: data.employeeId,
        trainingId: data.trainingId,
        dateCompleted: completedDate,
        NOT: { id },
      },
    });

    if (existingRecord) {
      throw new Error("DUPLICATE_TRAINING_RECORD");
    }

    // Determine which images to delete from disk
    const removedIds = data.removedImageIds ?? [];
    const imagesToDelete = currentRecord.images.filter((img) =>
      removedIds.includes(img.id),
    );

    // Save new images
    const savedImages = await fileUploadService.saveFiles(images, "training");

    const updatedTrainingRecord = await prisma.trainingRecords.update({
      where: { id },
      data: {
        employeeId: data.employeeId,
        trainingId: data.trainingId,
        dateCompleted: completedDate,
        trainer: data.trainer,
        images: {
          deleteMany: removedIds.length > 0 ? { id: { in: removedIds } } : undefined,
          create: savedImages.map((img) => ({
            imagePath: img.imagePath,
            imageType: img.imageType,
            originalName: img.originalName,
          })),
        },
      },
      include: {
        personTrained: {
          include: {
            department: true,
            location: true,
          },
        },
        training: true,
        images: true,
      },
    });

    // Delete removed image files from disk
    await fileUploadService.deleteFiles(
      imagesToDelete.map((img) => img.imagePath),
    );

    await prisma.history.create({
      data: {
        tableName: "TrainingRecords",
        recordId: id.toString(),
        action: "UPDATE",
        oldValues: JSON.stringify(currentRecord),
        newValues: JSON.stringify(updatedTrainingRecord),
        userId,
      },
    });

    return updatedTrainingRecord;
  }

  async deleteTrainingRecord(id: number, userId: string) {
    const currentRecord = await prisma.trainingRecords.findUnique({
      where: { id },
      include: { images: true },
    });

    if (!currentRecord) {
      throw new Error("TRAINING_RECORD_NOT_FOUND");
    }

    // onDelete: Cascade on TrainingImage will remove DB rows automatically.
    // Delete image files from disk first.
    await fileUploadService.deleteFiles(
      currentRecord.images.map((img) => img.imagePath),
    );

    await prisma.trainingRecords.delete({
      where: { id },
    });

    await prisma.history.create({
      data: {
        tableName: "TrainingRecords",
        recordId: id.toString(),
        action: "DELETE",
        oldValues: JSON.stringify(currentRecord),
        userId,
      },
    });

    return { message: "Training record deleted successfully" };
  }
}

export const trainingRecordService = new TrainingRecordService();
