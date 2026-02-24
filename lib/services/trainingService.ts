import prisma from "@/lib/prisma";
import { Category } from "@/generated/prisma_client";

export interface GetTrainingsOptions {
  activeOnly?: boolean;
  category?: string | null;
  includeRequirements?: boolean;
}

export interface GetTrainingByIdOptions {
  activeOnly?: boolean;
  includeRequirements?: boolean;
  includeRecords?: boolean;
}

export class TrainingService {
  async getTrainings(options: GetTrainingsOptions) {
    const { activeOnly, category, includeRequirements } = options;

    const whereClause: any = {};
    if (activeOnly) {
      whereClause.isActive = true;
    }
    if (category) {
      whereClause.category = category;
    }

    const includeClause: any = {
      _count: {
        select: { trainingRecords: true },
      },
    };

    if (includeRequirements) {
      includeClause.requirements = {
        include: {
          training: true,
          department: true,
          location: true,
        },
      };
      includeClause.trainingExemptions = {
        include: {
          training: true,
          employee: true,
        },
      };
    }

    const trainings = await prisma.training.findMany({
      include: includeClause,
      where: whereClause,
      orderBy: {
        title: "asc",
      },
    });

    return trainings;
  }

  async getTrainingById(id: number, options: GetTrainingByIdOptions) {
    const { activeOnly, includeRequirements } = options;

    const trainingRecordsWhereClause: any = {};
    if (activeOnly) {
      trainingRecordsWhereClause.personTrained = {
        isActive: true,
      };
    }

    const includeClause: any = {
      trainingRecords: {
        where: trainingRecordsWhereClause,
        include: {
          personTrained: {
            include: {
              department: true,
              location: true,
            },
          },
        },
        orderBy: {
          dateCompleted: "desc",
        },
      },
      _count: {
        select: { trainingRecords: true },
      },
    };

    if (includeRequirements) {
      includeClause.requirements = {
        include: {
          training: true,
          department: true,
          location: true,
        },
      };
      includeClause.trainingExemptions = {
        include: {
          training: true,
          employee: true,
        },
      };
    }

    const training = await prisma.training.findUnique({
      where: { id },
      include: includeClause,
    });

    if (!training) {
      throw new Error("TRAINING_NOT_FOUND");
    }

    return training;
  }

  async createTraining(
    data: {
      category: Category;
      title: string;
      requirements?: Array<{ departmentId: number; locationId: number }>;
    },
    userId: string,
  ) {
    if (data.category === "SOP") {
      const training1 = await prisma.training.create({
        data: {
          category: data.category,
          title: data.title + " - Task Sheet",
        },
      });

      const training2 = await prisma.training.create({
        data: {
          category: data.category,
          title: data.title + " - Practical",
        },
      });

      if (data.requirements) {
        for (const req of data.requirements) {
          await prisma.trainingRequirement.create({
            data: {
              trainingId: training1.id,
              departmentId: req.departmentId,
              locationId: req.locationId,
            },
          });

          await prisma.trainingRequirement.create({
            data: {
              trainingId: training2.id,
              departmentId: req.departmentId,
              locationId: req.locationId,
            },
          });
        }
      }

      await prisma.history.create({
        data: {
          tableName: "Training",
          recordId: training1.id.toString(),
          action: "CREATE",
          newValues: JSON.stringify(training1),
          userId,
        },
      });

      await prisma.history.create({
        data: {
          tableName: "Training",
          recordId: training2.id.toString(),
          action: "CREATE",
          newValues: JSON.stringify(training2),
          userId,
        },
      });

      return [training1, training2];
    } else {
      const training = await prisma.training.create({
        data: {
          category: data.category,
          title: data.title,
        },
      });

      if (data.requirements) {
        for (const req of data.requirements) {
          await prisma.trainingRequirement.create({
            data: {
              trainingId: training.id,
              departmentId: req.departmentId,
              locationId: req.locationId,
            },
          });
        }
      }

      await prisma.history.create({
        data: {
          tableName: "Training",
          recordId: training.id.toString(),
          action: "CREATE",
          newValues: JSON.stringify(training),
          userId,
        },
      });

      return training;
    }
  }

  async updateTraining(
    id: number,
    data: {
      category: Category;
      title: string;
      isActive?: boolean;
      requirements?: Array<{ departmentId: number; locationId: number }>;
    },
    userId: string,
  ) {
    const currentTraining = await prisma.training.findUnique({
      where: { id },
      include: {
        requirements: true,
      },
    });

    if (!currentTraining) {
      throw new Error("TRAINING_NOT_FOUND");
    }

    // Check if we're changing from non-SOP to SOP category
    if (currentTraining.category !== "SOP" && data.category === "SOP") {
      const updatedTraining = await prisma.training.update({
        where: { id },
        data: {
          category: data.category,
          title: data.title + " - Task Sheet",
          isActive: data.isActive,
        },
      });

      const practicalTraining = await prisma.training.create({
        data: {
          category: data.category,
          title: data.title + " - Practical",
          isActive: data.isActive,
        },
      });

      if (data.requirements) {
        await prisma.trainingRequirement.deleteMany({
          where: { trainingId: id },
        });

        for (const req of data.requirements) {
          await prisma.trainingRequirement.create({
            data: {
              trainingId: updatedTraining.id,
              departmentId: req.departmentId,
              locationId: req.locationId,
            },
          });

          await prisma.trainingRequirement.create({
            data: {
              trainingId: practicalTraining.id,
              departmentId: req.departmentId,
              locationId: req.locationId,
            },
          });
        }
      } else {
        await prisma.trainingRequirement.deleteMany({
          where: { trainingId: id },
        });

        for (const req of currentTraining.requirements) {
          await prisma.trainingRequirement.create({
            data: {
              trainingId: updatedTraining.id,
              departmentId: req.departmentId,
              locationId: req.locationId,
            },
          });

          await prisma.trainingRequirement.create({
            data: {
              trainingId: practicalTraining.id,
              departmentId: req.departmentId,
              locationId: req.locationId,
            },
          });
        }
      }

      await prisma.history.create({
        data: {
          tableName: "Training",
          recordId: id.toString(),
          action: "UPDATE",
          oldValues: JSON.stringify(currentTraining),
          newValues: JSON.stringify(updatedTraining),
          userId,
        },
      });

      await prisma.history.create({
        data: {
          tableName: "Training",
          recordId: practicalTraining.id.toString(),
          action: "CREATE",
          newValues: JSON.stringify(practicalTraining),
          userId,
        },
      });

      return [updatedTraining, practicalTraining];
    } else {
      const updatedTraining = await prisma.training.update({
        where: { id },
        data: {
          category: data.category,
          title: data.title,
          isActive: data.isActive,
        },
      });

      await prisma.history.create({
        data: {
          tableName: "Training",
          recordId: id.toString(),
          action: "UPDATE",
          oldValues: JSON.stringify(currentTraining),
          newValues: JSON.stringify(updatedTraining),
          userId,
        },
      });

      if (data.requirements) {
        await prisma.trainingRequirement.deleteMany({
          where: { trainingId: id },
        });

        for (const req of data.requirements) {
          await prisma.trainingRequirement.create({
            data: {
              trainingId: updatedTraining.id,
              departmentId: req.departmentId,
              locationId: req.locationId,
            },
          });
        }
      }

      return updatedTraining;
    }
  }

  async deleteTraining(id: number, userId: string) {
    const currentTraining = await prisma.training.findUnique({
      where: { id },
    });

    if (!currentTraining) {
      throw new Error("TRAINING_NOT_FOUND");
    }

    const trainingRecordsCount = await prisma.trainingRecords.count({
      where: { trainingId: id },
    });

    if (trainingRecordsCount > 0) {
      throw new Error("TRAINING_HAS_RECORDS");
    }

    await prisma.training.delete({
      where: { id },
    });
    await prisma.trainingRequirement.deleteMany({
      where: { trainingId: id },
    });

    await prisma.history.create({
      data: {
        tableName: "Training",
        recordId: id.toString(),
        action: "DELETE",
        oldValues: JSON.stringify(currentTraining),
        userId,
      },
    });

    return { message: "Training course deleted successfully" };
  }
}

export const trainingService = new TrainingService();
