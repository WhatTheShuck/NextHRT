import prisma from "@/lib/prisma";
import { UserRole } from "@/generated/prisma_client";
import { fileUploadService } from "./fileUploadService";

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
    };

    if (userRole === "Admin") {
      return await prisma.trainingRecords.findMany({
        where: whereClause,
        include: includeClause,
        orderBy: {
          dateCompleted: "desc" as const,
        },
      });
    } else if (userRole === "DepartmentManager") {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { managedDepartments: true },
      });

      if (!user) {
        throw new Error("USER_NOT_FOUND");
      }

      const departmentIds = user.managedDepartments.map((dept) => dept.id);

      const employees = await prisma.employee.findMany({
        where: {
          departmentId: { in: departmentIds },
        },
        include: {
          department: true,
          location: true,
        },
        orderBy: {
          lastName: "asc",
        },
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
    } else {
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
    image: File | null,
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

    let imagePath: string | null = null;
    let imageType: string | null = null;

    if (image && image.size > 0) {
      const saved = await fileUploadService.saveFile(image, "training");
      imagePath = saved.imagePath;
      imageType = saved.imageType;
    }

    const trainingRecord = await prisma.trainingRecords.create({
      data: {
        employeeId: data.employeeId,
        trainingId: data.trainingId,
        dateCompleted: completedDate,
        trainer: data.trainer,
        imagePath,
        imageType,
      },
      include: {
        personTrained: {
          include: {
            department: true,
            location: true,
          },
        },
        training: true,
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
      removeImage?: boolean;
    },
    image: File | null,
    userId: string,
  ) {
    const currentRecord = await prisma.trainingRecords.findUnique({
      where: { id },
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

    let imagePath: string | null = currentRecord.imagePath;
    let imageType: string | null = currentRecord.imageType;
    let oldImagePath: string | null = null;

    if (data.removeImage || (image && image.size > 0)) {
      oldImagePath = currentRecord.imagePath;
      imagePath = null;
      imageType = null;
    }

    if (image && image.size > 0) {
      const saved = await fileUploadService.saveFile(image, "training");
      imagePath = saved.imagePath;
      imageType = saved.imageType;
    }

    const updatedTrainingRecord = await prisma.trainingRecords.update({
      where: { id },
      data: {
        employeeId: data.employeeId,
        trainingId: data.trainingId,
        dateCompleted: completedDate,
        trainer: data.trainer,
        imagePath,
        imageType,
      },
      include: {
        personTrained: {
          include: {
            department: true,
            location: true,
          },
        },
        training: true,
      },
    });

    if (oldImagePath) {
      await fileUploadService.deleteFile(oldImagePath);
    }

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
    });

    if (!currentRecord) {
      throw new Error("TRAINING_RECORD_NOT_FOUND");
    }

    await prisma.trainingRecords.delete({
      where: { id },
    });

    if (currentRecord.imagePath) {
      await fileUploadService.deleteFile(currentRecord.imagePath);
    }

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
