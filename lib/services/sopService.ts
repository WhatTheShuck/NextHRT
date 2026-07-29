import { mkdir, readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { createHash } from "crypto";
import path from "path";
import prisma from "@/lib/prisma";
import { fileUploadService } from "@/lib/services/fileUploadService";
import { currentRevision } from "@/lib/services/trainingCompliance";

export interface SopQuestionInput {
  id?: number;
  order: number;
  questionText: string;
  markerNotes?: string | null;
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
