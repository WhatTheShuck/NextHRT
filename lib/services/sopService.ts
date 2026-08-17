import { mkdir, readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { createHash } from "crypto";
import path from "path";
import prisma from "@/lib/prisma";
import { fileUploadService } from "@/lib/services/fileUploadService";
import { currentRevision } from "@/lib/services/trainingCompliance";
import { enqueue } from "@/lib/jobs/jobQueue";
import { practicalTitle, sopBaseTitle, taskSheetTitle } from "@/lib/sop/pairing";

export interface SopQuestionInput {
  id?: number;
  order: number;
  questionText: string;
  markerNotes?: string | null;
}

/** One row of the SOP directory: the pair as a single thing, not two trainings. */
export interface SopSummary {
  taskSheetId: number;
  practicalId: number | null;
  title: string; // base title, no half-suffix
  isActive: boolean;
  requiresRetrainingOnRevision: boolean;
  paired: boolean;
  currentRevision: {
    id: number;
    revisionLabel: string;
    effectiveDate: string; // ISO — the shape the directory receives over JSON
    hasDocument: boolean;
    questionCount: number;
  } | null;
  revisionCount: number;
  trainers: Array<{ employeeId: number; name: string; hasAccount: boolean }>;
  requirements: Array<{
    departmentId: number;
    departmentName: string;
    locationId: number;
    locationName: string;
  }>;
  assessments: {
    inProgress: number;
    awaitingMarking: number;
    changesRequested: number;
    passed: number;
  };
  acknowledgements: number; // Task Sheet records — employees who have read the procedure
  completions: number; // Practical records — employees signed off as competent
  /** Everything standing between this SOP and being takeable, in reading order. */
  issues: string[];
}

export interface UpdateSopPairInput {
  title: string; // base title
  isActive: boolean;
  requiresRetrainingOnRevision: boolean;
  requirements?: Array<{ departmentId: number; locationId: number }>;
}

class SopService {
  /**
   * Resolve the SOP pair from either half via the first-class link.
   * The Task Sheet row holds the FK; the Practical resolves via the inverse.
   * Returns null when the training is not part of a linked pair.
   */
  async resolvePair(
    trainingId: number,
  ): Promise<{ taskSheetId: number; practicalId: number } | null> {
    const training = await prisma.training.findUnique({
      where: { id: trainingId },
      select: { id: true, sopPartnerId: true, sopPartnerOf: { select: { id: true } } },
    });
    if (!training) throw new Error("TRAINING_NOT_FOUND");
    if (training.sopPartnerId !== null) {
      return { taskSheetId: training.id, practicalId: training.sopPartnerId };
    }
    if (training.sopPartnerOf) {
      return { taskSheetId: training.sopPartnerOf.id, practicalId: training.id };
    }
    return null;
  }

  // ---- Directory ----

  /**
   * Every SOP as one row per pair, keyed on the Task Sheet (which owns the
   * revisions, procedure PDF, questions and trainers). Practical halves are
   * folded into their Task Sheet; SOP-category trainings with no partner link
   * are still listed, flagged, so they can't quietly vanish from both the
   * training list and this one.
   */
  async listSops(): Promise<SopSummary[]> {
    const trainings = await prisma.training.findMany({
      where: { category: "SOP" },
      include: {
        requirements: { include: { department: true, location: true } },
        revisions: {
          select: {
            id: true,
            revisionLabel: true,
            effectiveDate: true,
            createdAt: true,
            overrideRequiresRetraining: true,
            documentPath: true,
            _count: { select: { sopQuestions: true } },
          },
        },
        sopTrainerAssignments: {
          include: {
            employee: {
              select: {
                id: true,
                legalFirstName: true,
                legalLastName: true,
                preferredFirstName: true,
                preferredLastName: true,
                User: { select: { id: true } },
              },
            },
          },
        },
        _count: { select: { trainingRecords: true } },
      },
      orderBy: { title: "asc" },
    });

    type Row = (typeof trainings)[number];
    const byId = new Map<number, Row>(trainings.map((t) => [t.id, t]));
    // Practical halves are reachable from their Task Sheet's sopPartnerId.
    const practicalIds = new Set(
      trainings.map((t) => t.sopPartnerId).filter((id): id is number => id !== null),
    );

    // Assessment counts arrive per revision; map them back onto the training
    // that owns the revision rather than issuing a query per SOP.
    const revisionOwner = new Map<number, number>();
    for (const training of trainings) {
      for (const revision of training.revisions) {
        revisionOwner.set(revision.id, training.id);
      }
    }
    const assessmentGroups = await prisma.sopAssessment.groupBy({
      by: ["revisionId", "status"],
      _count: { _all: true },
    });
    const assessmentsByTraining = new Map<number, SopSummary["assessments"]>();
    for (const group of assessmentGroups) {
      const trainingId = revisionOwner.get(group.revisionId);
      if (trainingId === undefined) continue;
      const bucket = assessmentsByTraining.get(trainingId) ?? {
        inProgress: 0,
        awaitingMarking: 0,
        changesRequested: 0,
        passed: 0,
      };
      const count = group._count._all;
      if (group.status === "InProgress") bucket.inProgress += count;
      else if (group.status === "Submitted") bucket.awaitingMarking += count;
      else if (group.status === "ChangesRequested") bucket.changesRequested += count;
      else if (group.status === "Passed") bucket.passed += count;
      // Superseded assessments are history — they belong to no live bucket.
      assessmentsByTraining.set(trainingId, bucket);
    }

    const now = new Date();
    const summaries: SopSummary[] = [];

    for (const training of trainings) {
      // Skip the Practical half: it is rendered as part of its Task Sheet.
      if (practicalIds.has(training.id)) continue;

      const practical =
        training.sopPartnerId !== null
          ? (byId.get(training.sopPartnerId) ?? null)
          : null;
      const paired = practical !== null;

      const current = currentRevision(
        training.revisions.map((r) => ({
          id: r.id,
          effectiveDate: r.effectiveDate,
          createdAt: r.createdAt,
          overrideRequiresRetraining: r.overrideRequiresRetraining,
        })),
        now,
      );
      const currentRow = current
        ? training.revisions.find((r) => r.id === current.id)!
        : null;

      const trainers = training.sopTrainerAssignments.map((assignment) => ({
        employeeId: assignment.employeeId,
        name: `${assignment.employee.preferredFirstName ?? assignment.employee.legalFirstName} ${
          assignment.employee.preferredLastName ?? assignment.employee.legalLastName
        }`,
        hasAccount: assignment.employee.User !== null,
      }));

      const assessments = assessmentsByTraining.get(training.id) ?? {
        inProgress: 0,
        awaitingMarking: 0,
        changesRequested: 0,
        passed: 0,
      };

      const issues: string[] = [];
      if (!paired) issues.push("Not paired with a Practical");
      if (currentRow === null) issues.push("No current revision");
      if (currentRow !== null && !currentRow.documentPath) {
        issues.push("No procedure PDF");
      }
      if (currentRow !== null && currentRow._count.sopQuestions === 0) {
        issues.push("No questions");
      }
      if (trainers.length === 0) issues.push("No designated trainers");
      if (trainers.length > 0 && trainers.every((t) => !t.hasAccount)) {
        issues.push("No trainer has a login");
      }
      if (practical !== null && practical.isActive !== training.isActive) {
        issues.push("Task Sheet and Practical differ in status");
      }

      summaries.push({
        taskSheetId: training.id,
        practicalId: practical?.id ?? null,
        title: sopBaseTitle(training.title),
        isActive: training.isActive,
        requiresRetrainingOnRevision: training.requiresRetrainingOnRevision,
        paired,
        currentRevision: currentRow
          ? {
              id: currentRow.id,
              revisionLabel: currentRow.revisionLabel,
              effectiveDate: currentRow.effectiveDate.toISOString(),
              hasDocument: currentRow.documentPath !== null,
              questionCount: currentRow._count.sopQuestions,
            }
          : null,
        revisionCount: training.revisions.length,
        trainers,
        requirements: training.requirements.map((req) => ({
          departmentId: req.departmentId,
          departmentName: req.department.name,
          locationId: req.locationId,
          locationName: req.location.name,
        })),
        assessments,
        acknowledgements: training._count.trainingRecords,
        completions: practical?._count.trainingRecords ?? 0,
        issues,
      });
    }

    return summaries.sort((a, b) => a.title.localeCompare(b.title));
  }

  /**
   * Edit the pair as one thing: the name is stored suffixed on each half, and
   * status, retraining policy and requirements are kept identical across both
   * so the two rows can never drift apart.
   */
  async updatePair(
    taskSheetId: number,
    data: UpdateSopPairInput,
    userId: string,
  ) {
    const pair = await this.resolvePair(taskSheetId);
    if (!pair) throw new Error("NOT_AN_SOP_PAIR");
    if (pair.taskSheetId !== taskSheetId) throw new Error("NOT_A_TASK_SHEET");

    const baseTitle = sopBaseTitle(data.title).trim();
    if (!baseTitle) throw new Error("TITLE_REQUIRED");

    const before = await prisma.training.findMany({
      where: { id: { in: [pair.taskSheetId, pair.practicalId] } },
    });

    const shared = {
      isActive: data.isActive,
      requiresRetrainingOnRevision: data.requiresRetrainingOnRevision,
    };

    await prisma.$transaction(async (tx) => {
      await tx.training.update({
        where: { id: pair.taskSheetId },
        data: { ...shared, title: taskSheetTitle(baseTitle) },
      });
      await tx.training.update({
        where: { id: pair.practicalId },
        data: { ...shared, title: practicalTitle(baseTitle) },
      });

      if (data.requirements) {
        await tx.trainingRequirement.deleteMany({
          where: { trainingId: { in: [pair.taskSheetId, pair.practicalId] } },
        });
        for (const req of data.requirements) {
          for (const trainingId of [pair.taskSheetId, pair.practicalId]) {
            await tx.trainingRequirement.create({
              data: {
                trainingId,
                departmentId: req.departmentId,
                locationId: req.locationId,
              },
            });
          }
        }
      }
    });

    for (const trainingId of [pair.taskSheetId, pair.practicalId]) {
      await prisma.history.create({
        data: {
          tableName: "Training",
          recordId: trainingId.toString(),
          action: "UPDATE",
          oldValues: JSON.stringify(before.find((t) => t.id === trainingId)),
          newValues: JSON.stringify({ ...shared, title: baseTitle }),
          userId,
        },
      });
    }

    await enqueue("REQUIREMENTS_CACHE_REBUILD");

    return this.getSop(pair.taskSheetId);
  }

  /** One directory row, refetched after a write. */
  async getSop(taskSheetId: number): Promise<SopSummary> {
    const all = await this.listSops();
    const found = all.find((s) => s.taskSheetId === taskSheetId);
    if (!found) throw new Error("SOP_NOT_FOUND");
    return found;
  }

  private async assertTaskSheetRevision(trainingId: number, revisionId: number) {
    const pair = await this.resolvePair(trainingId);
    if (!pair || pair.taskSheetId !== trainingId) throw new Error("NOT_A_TASK_SHEET");
    const revision = await prisma.trainingRevision.findUnique({
      where: { id: revisionId },
      select: { id: true, trainingId: true, documentPath: true },
    });
    if (!revision || revision.trainingId !== trainingId) {
      throw new Error("REVISION_NOT_FOUND");
    }
    return { pair, revision };
  }

  // ---- Questions ----

  async listQuestions(revisionId: number) {
    return prisma.sopQuestion.findMany({
      where: { revisionId },
      orderBy: { order: "asc" },
    });
  }

  /** true when any assessment pinned to this revision was ever submitted */
  async revisionHasSubmissions(revisionId: number): Promise<boolean> {
    const count = await prisma.sopAssessment.count({
      where: { revisionId, submittedAt: { not: null } },
    });
    return count > 0;
  }

  /**
   * Full-replace diff: rows with an id are updated, rows without are created,
   * rows that disappeared are deleted. Deleting an answered question is
   * blocked up front (QUESTION_IN_USE) so the transaction never trips the
   * DB-level Restrict.
   */
  async replaceQuestions(
    trainingId: number,
    revisionId: number,
    questions: SopQuestionInput[],
    userId: string,
  ) {
    await this.assertTaskSheetRevision(trainingId, revisionId);

    const existing = await prisma.sopQuestion.findMany({
      where: { revisionId },
      select: { id: true },
    });
    const keepIds = new Set(
      questions.filter((q) => q.id !== undefined).map((q) => q.id as number),
    );
    const deleteIds = existing.filter((e) => !keepIds.has(e.id)).map((e) => e.id);

    if (deleteIds.length > 0) {
      const inUseBy = await prisma.sopAssessment.count({
        where: { answers: { some: { questionId: { in: deleteIds } } } },
      });
      if (inUseBy > 0) {
        // Spec guard rail: the editor surfaces this as "in use by N
        // assessments", so the count rides along on the error.
        throw Object.assign(new Error("QUESTION_IN_USE"), { count: inUseBy });
      }
    }

    await prisma.$transaction(async (tx) => {
      if (deleteIds.length > 0) {
        await tx.sopQuestion.deleteMany({ where: { id: { in: deleteIds } } });
      }
      for (const q of questions) {
        if (q.id !== undefined) {
          await tx.sopQuestion.update({
            where: { id: q.id },
            data: {
              order: q.order,
              questionText: q.questionText,
              markerNotes: q.markerNotes ?? null,
            },
          });
        } else {
          await tx.sopQuestion.create({
            data: {
              revisionId,
              order: q.order,
              questionText: q.questionText,
              markerNotes: q.markerNotes ?? null,
            },
          });
        }
      }
    });

    await prisma.history.create({
      data: {
        tableName: "SopQuestion",
        recordId: `revision:${revisionId}`,
        action: "UPDATE",
        newValues: JSON.stringify(questions),
        userId,
      },
    });

    return this.listQuestions(revisionId);
  }

  /**
   * Copy questions + procedure PDF forward from the revision that was current
   * before `newRevisionId` was created. No-op for non-Task-Sheet trainings.
   * PDF bytes are duplicated (fresh UUID) so revisions never share a file.
   */
  async copyForward(trainingId: number, newRevisionId: number): Promise<void> {
    const pair = await this.resolvePair(trainingId);
    if (!pair || pair.taskSheetId !== trainingId) return;

    const others = await prisma.trainingRevision.findMany({
      where: { trainingId, id: { not: newRevisionId } },
      select: {
        id: true,
        effectiveDate: true,
        createdAt: true,
        overrideRequiresRetraining: true,
      },
    });
    const source = currentRevision(others, new Date());
    if (!source) return;

    const sourceRevision = await prisma.trainingRevision.findUnique({
      where: { id: source.id },
      select: { documentPath: true, sopQuestions: { orderBy: { order: "asc" } } },
    });
    if (!sourceRevision) return;

    if (sourceRevision.sopQuestions.length > 0) {
      await prisma.sopQuestion.createMany({
        data: sourceRevision.sopQuestions.map((q) => ({
          revisionId: newRevisionId,
          order: q.order,
          questionText: q.questionText,
          markerNotes: q.markerNotes,
        })),
      });
    }

    if (sourceRevision.documentPath) {
      const sharedPath = await this.shareStoredFile(sourceRevision.documentPath);
      await prisma.trainingRevision.update({
        where: { id: newRevisionId },
        data: { documentPath: sharedPath },
      });
    }
  }

  /**
   * Store bytes under their own SHA-256 digest, so identical content always
   * resolves to one file. The filename *is* the hash, so an existing file is
   * by definition already the right bytes and is left alone.
   *
   * Anything stored this way may end up referenced by more than one revision —
   * delete only via releaseStoredFile().
   */
  private async writeContentAddressed(
    bytes: Buffer,
    extension: string,
  ): Promise<string> {
    const targetDir = path.join(process.cwd(), "uploads", "sop-documents");
    if (!existsSync(targetDir)) {
      await mkdir(targetDir, { recursive: true });
    }
    const digest = createHash("sha256").update(bytes).digest("hex");
    const targetName = `${digest}${extension}`;
    const targetPath = path.join(targetDir, targetName);
    if (!existsSync(targetPath)) {
      await writeFile(targetPath, bytes);
    }
    return `sop-documents/${targetName}`;
  }

  /**
   * Carry a procedure document onto a new revision. The document is unchanged
   * by definition here, so the new revision points at the *same* stored file
   * rather than getting a byte-identical copy — an SOP with 20 revisions costs
   * one file, not 20.
   *
   * Legacy uploads are UUID-named; the first carry-forward rewrites those under
   * their hash, after which every further revision reuses that one file.
   */
  private async shareStoredFile(relativePath: string): Promise<string> {
    const bytes = await readFile(path.join(process.cwd(), "uploads", relativePath));
    const stored = await this.writeContentAddressed(
      bytes,
      path.extname(relativePath),
    );
    return stored;
  }

  /**
   * Drop one revision's claim on a stored document. Because revisions share
   * content-addressed files, the bytes survive until no revision references
   * them — otherwise replacing the document on one revision would blank it on
   * every other revision carrying the same procedure.
   */
  private async releaseStoredFile(
    documentPath: string,
    exceptRevisionId: number,
  ): Promise<void> {
    const stillReferenced = await prisma.trainingRevision.count({
      where: { documentPath, id: { not: exceptRevisionId } },
    });
    if (stillReferenced > 0) return;
    await fileUploadService.deleteFile(documentPath);
  }

  // ---- Procedure document ----

  async uploadDocument(
    trainingId: number,
    revisionId: number,
    file: File,
    userId: string,
  ) {
    const { revision } = await this.assertTaskSheetRevision(trainingId, revisionId);
    if (file.type !== "application/pdf") throw new Error("INVALID_FILE_TYPE");

    fileUploadService.validateFile(file);
    const bytes = Buffer.from(await file.arrayBuffer());
    const savedPath = await this.writeContentAddressed(
      bytes,
      path.extname(file.name) || ".pdf",
    );

    await prisma.trainingRevision.update({
      where: { id: revisionId },
      data: { documentPath: savedPath },
    });
    // Re-uploading the same bytes resolves to the same path — releasing it here
    // would delete the file this revision now points at.
    if (revision.documentPath && revision.documentPath !== savedPath) {
      await this.releaseStoredFile(revision.documentPath, revisionId);
    }

    await prisma.history.create({
      data: {
        tableName: "TrainingRevision",
        recordId: revisionId.toString(),
        action: "UPDATE",
        oldValues: JSON.stringify({ documentPath: revision.documentPath }),
        newValues: JSON.stringify({ documentPath: savedPath }),
        userId,
      },
    });

    return { documentPath: savedPath };
  }

  async deleteDocument(trainingId: number, revisionId: number, userId: string) {
    const { revision } = await this.assertTaskSheetRevision(trainingId, revisionId);
    if (!revision.documentPath) return;

    await prisma.trainingRevision.update({
      where: { id: revisionId },
      data: { documentPath: null },
    });
    await this.releaseStoredFile(revision.documentPath, revisionId);

    await prisma.history.create({
      data: {
        tableName: "TrainingRevision",
        recordId: revisionId.toString(),
        action: "UPDATE",
        oldValues: JSON.stringify({ documentPath: revision.documentPath }),
        newValues: JSON.stringify({ documentPath: null }),
        userId,
      },
    });
  }

  // ---- Designated trainers ----

  async listTrainers(trainingId: number) {
    const pair = await this.resolvePair(trainingId);
    if (!pair) throw new Error("NOT_AN_SOP_PAIR");
    return prisma.sopTrainerAssignment.findMany({
      where: { trainingId: pair.taskSheetId },
      include: {
        employee: {
          select: {
            id: true,
            legalFirstName: true,
            legalLastName: true,
            preferredFirstName: true,
            preferredLastName: true,
            User: { select: { email: true } },
          },
        },
      },
    });
  }

  async setTrainers(trainingId: number, employeeIds: number[], userId: string) {
    const pair = await this.resolvePair(trainingId);
    if (!pair) throw new Error("NOT_AN_SOP_PAIR");

    await prisma.$transaction(async (tx) => {
      await tx.sopTrainerAssignment.deleteMany({
        where: { trainingId: pair.taskSheetId },
      });
      if (employeeIds.length > 0) {
        await tx.sopTrainerAssignment.createMany({
          data: employeeIds.map((employeeId) => ({
            trainingId: pair.taskSheetId,
            employeeId,
          })),
        });
      }
    });

    await prisma.history.create({
      data: {
        tableName: "SopTrainerAssignment",
        recordId: pair.taskSheetId.toString(),
        action: "UPDATE",
        newValues: JSON.stringify(employeeIds),
        userId,
      },
    });

    return this.listTrainers(pair.taskSheetId);
  }
}

export const sopService = new SopService();
