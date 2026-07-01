import prisma from "@/lib/prisma";
import { enqueue } from "@/lib/jobs/jobQueue";
import { currentRevision } from "@/lib/services/trainingCompliance";

class TrainingRevisionService {
  async listForTraining(trainingId: number) {
    return prisma.trainingRevision.findMany({
      where: { trainingId },
      select: {
        id: true,
        revisionLabel: true,
        effectiveDate: true,
        description: true,
        overrideRequiresRetraining: true,
        createdAt: true,
      },
      orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    });
  }

  async createRevision(
    data: {
      trainingId: number;
      revisionLabel: string;
      effectiveDate: Date;
      description?: string;
      overrideRequiresRetraining?: boolean | null;
    },
    userId: string,
  ) {
    const training = await prisma.training.findUnique({
      where: { id: data.trainingId },
      select: {
        requiresRetrainingOnRevision: true,
        revisions: {
          select: { id: true, effectiveDate: true, createdAt: true, overrideRequiresRetraining: true },
        },
      },
    });

    if (!training) throw new Error("TRAINING_NOT_FOUND");

    const created = await prisma.trainingRevision.create({
      data: {
        trainingId: data.trainingId,
        revisionLabel: data.revisionLabel,
        effectiveDate: data.effectiveDate,
        description: data.description,
        overrideRequiresRetraining: data.overrideRequiresRetraining,
      },
    });

    await prisma.history.create({
      data: {
        tableName: "TrainingRevision",
        recordId: created.id.toString(),
        action: "CREATE",
        newValues: JSON.stringify(created),
        userId,
      },
    });

    // If the new revision is current as of now and requires retraining, rebuild the cache.
    const allRevisions = [
      ...training.revisions,
      {
        id: created.id,
        effectiveDate: created.effectiveDate,
        createdAt: created.createdAt,
        overrideRequiresRetraining: created.overrideRequiresRetraining,
      },
    ];
    const now = new Date();
    const cur = currentRevision(allRevisions, now);
    if (cur?.id === created.id) {
      const requiresRetraining =
        created.overrideRequiresRetraining ?? training.requiresRetrainingOnRevision;
      if (requiresRetraining) {
        await enqueue("REQUIREMENTS_CACHE_REBUILD");
      }
    }

    return created;
  }

  async updateRevision(
    id: number,
    data: {
      revisionLabel?: string;
      effectiveDate?: Date;
      description?: string;
      overrideRequiresRetraining?: boolean | null;
    },
    userId: string,
  ) {
    const existing = await prisma.trainingRevision.findUnique({
      where: { id },
      select: { trainingId: true },
    });
    if (!existing) throw new Error("REVISION_NOT_FOUND");

    const old = await prisma.trainingRevision.findUnique({ where: { id } });

    const updated = await prisma.trainingRevision.update({
      where: { id },
      data,
    });

    await prisma.history.create({
      data: {
        tableName: "TrainingRevision",
        recordId: id.toString(),
        action: "UPDATE",
        oldValues: JSON.stringify(old),
        newValues: JSON.stringify(updated),
        userId,
      },
    });

    // Check if the updated revision is now current and requires retraining.
    const training = await prisma.training.findUnique({
      where: { id: existing.trainingId },
      select: {
        requiresRetrainingOnRevision: true,
        revisions: {
          select: { id: true, effectiveDate: true, createdAt: true, overrideRequiresRetraining: true },
        },
      },
    });
    if (training) {
      const now = new Date();
      const cur = currentRevision(training.revisions, now);
      if (cur?.id === id) {
        const requiresRetraining =
          updated.overrideRequiresRetraining ?? training.requiresRetrainingOnRevision;
        if (requiresRetraining) {
          await enqueue("REQUIREMENTS_CACHE_REBUILD");
        }
      }
    }

    return updated;
  }

  async deleteRevision(id: number, userId: string) {
    const revision = await prisma.trainingRevision.findUnique({
      where: { id },
      include: { records: { select: { id: true }, take: 1 } },
    });

    if (!revision) throw new Error("REVISION_NOT_FOUND");
    if (revision.records.length > 0) throw new Error("REVISION_HAS_RECORDS");

    await prisma.trainingRevision.delete({ where: { id } });

    await prisma.history.create({
      data: {
        tableName: "TrainingRevision",
        recordId: id.toString(),
        action: "DELETE",
        oldValues: JSON.stringify(revision),
        userId,
      },
    });
  }
}

export const trainingRevisionService = new TrainingRevisionService();
