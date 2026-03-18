import prisma from "@/lib/prisma";
import { Category } from "@/generated/prisma_client/client";
import { enqueue } from "@/lib/jobs/jobQueue";

const trainingWithRelationsInclude = {
  requirements: {
    include: {
      department: true,
      location: true,
    },
  },
  trainingExemptions: {
    include: {
      employee: true,
    },
  },
  _count: {
    select: { trainingRecords: true },
  },
} as const;

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

      await enqueue("REQUIREMENTS_CACHE_REBUILD");

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

      await enqueue("REQUIREMENTS_CACHE_REBUILD");

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
        include: trainingWithRelationsInclude,
      });

      const practicalTraining = await prisma.training.create({
        data: {
          category: data.category,
          title: data.title + " - Practical",
          isActive: data.isActive,
        },
        include: trainingWithRelationsInclude,
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

      await enqueue("REQUIREMENTS_CACHE_REBUILD");

      return [updatedTraining, practicalTraining];
    } else if (currentTraining.category === "SOP" && data.category !== "SOP") {
      // SOP → non-SOP: strip suffix, delete sibling, update this record

      // Strip " - Task Sheet" or " - Practical" suffix the admin may have left in
      let baseTitle = data.title;
      if (baseTitle.endsWith(" - Task Sheet")) {
        baseTitle = baseTitle.slice(0, -" - Task Sheet".length);
      } else if (baseTitle.endsWith(" - Practical")) {
        baseTitle = baseTitle.slice(0, -" - Practical".length);
      }

      // Derive sibling title from the current stored title
      let siblingTitle: string | null = null;
      if (currentTraining.title.endsWith(" - Task Sheet")) {
        siblingTitle =
          currentTraining.title.slice(0, -" - Task Sheet".length) +
          " - Practical";
      } else if (currentTraining.title.endsWith(" - Practical")) {
        siblingTitle =
          currentTraining.title.slice(0, -" - Practical".length) +
          " - Task Sheet";
      }

      if (siblingTitle) {
        const sibling = await prisma.training.findFirst({
          where: { title: siblingTitle, category: "SOP" },
          include: { _count: { select: { trainingRecords: true } } },
        });

        if (sibling) {
          if (sibling._count.trainingRecords > 0) {
            throw new Error("SOP_SIBLING_HAS_RECORDS");
          }

          await prisma.trainingRequirement.deleteMany({
            where: { trainingId: sibling.id },
          });
          await prisma.trainingTicketExemption.deleteMany({
            where: { trainingId: sibling.id },
          });
          await prisma.training.delete({ where: { id: sibling.id } });

          await prisma.history.create({
            data: {
              tableName: "Training",
              recordId: sibling.id.toString(),
              action: "DELETE",
              oldValues: JSON.stringify(sibling),
              userId,
            },
          });
        }
      }

      let updatedTraining = await prisma.training.update({
        where: { id },
        data: {
          category: data.category,
          title: baseTitle,
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

      await enqueue("REQUIREMENTS_CACHE_REBUILD");

      return await prisma.training.findUnique({
        where: { id },
        include: trainingWithRelationsInclude,
      });
    } else {
      // Normal update: non-SOP → non-SOP or SOP → SOP (title/active/requirements change)
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

      await enqueue("REQUIREMENTS_CACHE_REBUILD");

      return await prisma.training.findUnique({
        where: { id },
        include: trainingWithRelationsInclude,
      });
    }
  }

  async deleteTraining(id: number, userId: string, deletePair = false) {
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

    // Resolve sibling for SOP pair deletion
    let sibling: (typeof currentTraining) | null = null;
    if (deletePair && currentTraining.category === "SOP") {
      let siblingTitle: string | null = null;
      if (currentTraining.title.endsWith(" - Task Sheet")) {
        siblingTitle =
          currentTraining.title.slice(0, -" - Task Sheet".length) +
          " - Practical";
      } else if (currentTraining.title.endsWith(" - Practical")) {
        siblingTitle =
          currentTraining.title.slice(0, -" - Practical".length) +
          " - Task Sheet";
      }

      if (siblingTitle) {
        sibling = await prisma.training.findFirst({
          where: { title: siblingTitle, category: "SOP" },
        });

        if (sibling) {
          const siblingRecords = await prisma.trainingRecords.count({
            where: { trainingId: sibling.id },
          });
          if (siblingRecords > 0) {
            throw new Error("SOP_SIBLING_HAS_RECORDS");
          }
        }
      }
    }

    // Helper to fully remove a training
    const deleteOne = async (t: typeof currentTraining) => {
      await prisma.trainingRequirement.deleteMany({
        where: { trainingId: t.id },
      });
      await prisma.trainingTicketExemption.deleteMany({
        where: { trainingId: t.id },
      });
      await prisma.training.delete({ where: { id: t.id } });
      await prisma.history.create({
        data: {
          tableName: "Training",
          recordId: t.id.toString(),
          action: "DELETE",
          oldValues: JSON.stringify(t),
          userId,
        },
      });
    };

    await deleteOne(currentTraining);
    if (sibling) await deleteOne(sibling);

    await enqueue("REQUIREMENTS_CACHE_REBUILD");

    return sibling ? [currentTraining, sibling] : [currentTraining];
  }
}

export const trainingService = new TrainingService();
