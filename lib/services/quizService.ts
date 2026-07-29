import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import prisma from "@/lib/prisma";
import { currentRevision } from "@/lib/services/trainingCompliance";
import { emailTemplateService } from "@/lib/services/emailTemplateService";
import { fileUploadService } from "@/lib/services/fileUploadService";
import { renderQuizResponsePdf } from "@/lib/services/quizPdfService";
import { appLink } from "@/lib/appUrl";
import {
  parseQuizDocument,
  visibleItems,
  stripAnswerKey,
  type QuizDocument,
  type QuizItem,
} from "@/lib/quiz/schema";

// Marks a TrainingImage as the auto-generated questionnaire evidence PDF, so a
// re-submission (restart → same-day record reuse) can replace its own prior
// copy without touching hand-uploaded attachments.
const QUIZ_EVIDENCE_IMAGE_TYPE = "quiz-evidence";

// Only InProgress is non-terminal; Completed and Superseded are terminal.
export const NON_TERMINAL_STATUSES = ["InProgress"];

const SELF_COMPLETED_TRAINER = "Self-completed (HRT)";

// Stored answer shape inside the JSON `answers` blob, keyed by item id.
// `wasCorrect` is present (point-in-time evidence) only for choice items that
// had a correct option — its presence also marks the item as locked.
interface StoredAnswer {
  value: unknown;
  wasCorrect?: boolean;
}

// The reveal returned from saveAnswer. Only correct-option choices lock + reveal.
export interface SaveAnswerReveal {
  locked: boolean;
  wasCorrect?: boolean;
  correctOptionId?: string;
  coaching?: string | null;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function nextDay(d: Date): Date {
  const x = startOfDay(d);
  x.setDate(x.getDate() + 1);
  return x;
}

class QuizService {
  // ---- Helpers ----

  private async linkedEmployeeId(userId: string): Promise<number | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { employeeId: true, name: true },
    });
    return user?.employeeId ?? null;
  }

  private async requireLinkedEmployeeId(userId: string): Promise<number> {
    const employeeId = await this.linkedEmployeeId(userId);
    if (employeeId === null) throw new Error("NO_LINKED_EMPLOYEE");
    return employeeId;
  }

  private async currentRevisionOf(trainingId: number) {
    const revisions = await prisma.trainingRevision.findMany({
      where: { trainingId },
      select: {
        id: true,
        effectiveDate: true,
        createdAt: true,
        overrideRequiresRetraining: true,
      },
    });
    return currentRevision(revisions, new Date());
  }

  private findItem(doc: QuizDocument, itemId: string): QuizItem | null {
    for (const section of doc.sections) {
      for (const item of section.items) {
        if (item.id === itemId) return item;
      }
    }
    return null;
  }

  // ---- Content (admin) ----

  async getContent(revisionId: number): Promise<string | null> {
    const revision = await prisma.trainingRevision.findUnique({
      where: { id: revisionId },
      select: { quizContent: true },
    });
    if (!revision) throw new Error("REVISION_NOT_FOUND");
    return revision.quizContent;
  }

  /** true when any response is pinned to this revision (evidence exists) */
  async revisionHasResponses(revisionId: number): Promise<boolean> {
    const count = await prisma.quizResponse.count({ where: { revisionId } });
    return count > 0;
  }

  /**
   * Validate + store quiz content on a revision. Validation always runs first
   * (invalid → INVALID_QUIZ_CONTENT). When the revision already has responses,
   * a material edit is warned (QUIZ_HAS_RESPONSES) unless `confirm` is set —
   * answers are keyed by item id so nothing breaks referentially, but material
   * changes belong in a new revision.
   */
  async setContent(
    trainingId: number,
    revisionId: number,
    content: string,
    userId: string,
    confirm = false,
  ): Promise<QuizDocument> {
    const revision = await prisma.trainingRevision.findUnique({
      where: { id: revisionId },
      select: { id: true, trainingId: true },
    });
    if (!revision || revision.trainingId !== trainingId) {
      throw new Error("REVISION_NOT_FOUND");
    }

    let doc: QuizDocument;
    try {
      doc = parseQuizDocument(content);
    } catch (error) {
      throw Object.assign(new Error("INVALID_QUIZ_CONTENT"), {
        detail: error instanceof Error ? error.message : String(error),
      });
    }

    if (!confirm && (await this.revisionHasResponses(revisionId))) {
      throw new Error("QUIZ_HAS_RESPONSES");
    }

    const normalised = JSON.stringify(doc);
    await prisma.trainingRevision.update({
      where: { id: revisionId },
      data: { quizContent: normalised },
    });
    await prisma.history.create({
      data: {
        tableName: "TrainingRevision",
        recordId: revisionId.toString(),
        action: "UPDATE",
        newValues: JSON.stringify({ quizContent: normalised }),
        userId,
      },
    });

    return doc;
  }

  /**
   * Copy quiz content forward from the revision that was current before
   * `newRevisionId` was created. No-op when the source has none. Hooked into
   * trainingRevisionService.createRevision alongside sopService.copyForward.
   */
  async copyForward(trainingId: number, newRevisionId: number): Promise<void> {
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
      select: { quizContent: true },
    });
    if (!sourceRevision?.quizContent) return;

    await prisma.trainingRevision.update({
      where: { id: newRevisionId },
      data: { quizContent: sourceRevision.quizContent },
    });
  }

  // ---- Lifecycle ----

  /**
   * Start (or resume) a response. Enforces the invariant: at most one
   * non-terminal response per employee per training (joined via
   * revision.trainingId, since QuizResponse carries no trainingId).
   */
  async start(userId: string, trainingId: number) {
    const employeeId = await this.requireLinkedEmployeeId(userId);

    const existing = await prisma.quizResponse.findFirst({
      where: {
        employeeId,
        status: { in: NON_TERMINAL_STATUSES },
        revision: { trainingId },
      },
    });
    if (existing) return existing;

    const cur = await this.currentRevisionOf(trainingId);
    if (!cur) throw new Error("QUIZ_NOT_READY");
    const revision = await prisma.trainingRevision.findUnique({
      where: { id: cur.id },
      select: { id: true, quizContent: true },
    });
    if (!revision?.quizContent) throw new Error("QUIZ_NOT_READY");

    const created = await prisma.quizResponse.create({
      data: { employeeId, revisionId: cur.id, status: "InProgress", answers: "{}" },
    });
    await prisma.history.create({
      data: {
        tableName: "QuizResponse",
        recordId: created.id.toString(),
        action: "CREATE",
        newValues: JSON.stringify(created),
        userId,
      },
    });

    return created;
  }

  /**
   * Supersede a stale non-terminal response and start fresh on the current
   * revision (one transaction — never leaves a dangling non-terminal row).
   */
  async restart(responseId: number, userId: string) {
    const employeeId = await this.requireLinkedEmployeeId(userId);
    const response = await prisma.quizResponse.findUnique({
      where: { id: responseId },
      include: { revision: { select: { trainingId: true } } },
    });
    if (!response) throw new Error("RESPONSE_NOT_FOUND");
    if (response.employeeId !== employeeId) throw new Error("NOT_AUTHORISED");
    if (!NON_TERMINAL_STATUSES.includes(response.status)) {
      throw new Error("INVALID_STATE");
    }

    const trainingId = response.revision.trainingId;
    const cur = await this.currentRevisionOf(trainingId);
    if (!cur) throw new Error("QUIZ_NOT_READY");
    const revision = await prisma.trainingRevision.findUnique({
      where: { id: cur.id },
      select: { quizContent: true },
    });
    if (!revision?.quizContent) throw new Error("QUIZ_NOT_READY");

    const created = await prisma.$transaction(async (tx) => {
      await tx.quizResponse.update({
        where: { id: responseId },
        data: { status: "Superseded", trainingRecordId: null },
      });
      return tx.quizResponse.create({
        data: {
          employeeId,
          revisionId: cur.id,
          status: "InProgress",
          answers: "{}",
          trainingRecordId: null,
        },
      });
    });

    await prisma.history.create({
      data: {
        tableName: "QuizResponse",
        recordId: responseId.toString(),
        action: "UPDATE",
        oldValues: JSON.stringify({ status: response.status }),
        newValues: JSON.stringify({ status: "Superseded", replacedBy: created.id }),
        userId,
      },
    });

    return created;
  }

  private async requireOwned(responseId: number, userId: string) {
    const employeeId = await this.requireLinkedEmployeeId(userId);
    const response = await prisma.quizResponse.findUnique({
      where: { id: responseId },
      include: { revision: { select: { trainingId: true, quizContent: true } } },
    });
    if (!response) throw new Error("RESPONSE_NOT_FOUND");
    if (response.employeeId !== employeeId) throw new Error("NOT_AUTHORISED");
    return response;
  }

  /**
   * Save one answer against the pinned revision's document. Choice items with a
   * correct option lock on reveal — the returned reveal carries correctness +
   * the correct option id + coaching, and re-answering a locked item is
   * rejected. Everything else advances without a reveal.
   */
  async saveAnswer(
    responseId: number,
    userId: string,
    input: { itemId: string; value: unknown },
  ): Promise<SaveAnswerReveal> {
    const response = await this.requireOwned(responseId, userId);
    if (response.status !== "InProgress") throw new Error("INVALID_STATE");
    if (!response.revision.quizContent) throw new Error("QUIZ_NOT_READY");

    const doc = parseQuizDocument(response.revision.quizContent);
    const item = this.findItem(doc, input.itemId);
    if (!item) throw new Error("INVALID_ITEM");

    const answers = JSON.parse(response.answers) as Record<string, StoredAnswer>;
    const prev = answers[input.itemId];
    if (prev && prev.wasCorrect !== undefined) throw new Error("ITEM_LOCKED");

    const { stored, reveal } = this.evaluateAnswer(item, input.value);
    answers[input.itemId] = stored;

    await prisma.quizResponse.update({
      where: { id: responseId },
      data: { answers: JSON.stringify(answers) },
    });

    return reveal;
  }

  /** Validate a value against its item and produce the stored answer + reveal. */
  private evaluateAnswer(
    item: QuizItem,
    value: unknown,
  ): { stored: StoredAnswer; reveal: SaveAnswerReveal } {
    const noReveal: SaveAnswerReveal = { locked: false };
    switch (item.type) {
      case "info":
        if (value !== true) throw new Error("INVALID_VALUE");
        return { stored: { value: true }, reveal: noReveal };
      case "scale":
        if (
          !Number.isInteger(value) ||
          (value as number) < 0 ||
          (value as number) >= item.scaleLabels.length
        ) {
          throw new Error("INVALID_VALUE");
        }
        return { stored: { value }, reveal: noReveal };
      case "text":
        if (typeof value !== "string") throw new Error("INVALID_VALUE");
        return { stored: { value }, reveal: noReveal };
      case "multiselect": {
        if (!Array.isArray(value)) throw new Error("INVALID_VALUE");
        const ids = new Set(item.options.map((o) => o.id));
        for (const v of value) {
          if (typeof v !== "string" || !ids.has(v)) throw new Error("INVALID_VALUE");
        }
        return { stored: { value }, reveal: noReveal };
      }
      case "choice": {
        if (typeof value !== "string") throw new Error("INVALID_VALUE");
        const opt = item.options.find((o) => o.id === value);
        if (!opt) throw new Error("INVALID_VALUE");
        const correctOpt = item.options.find((o) => o.correct);
        if (!correctOpt) {
          // Survey / gate choice — no correct option, no reveal, stays unlocked.
          return { stored: { value }, reveal: noReveal };
        }
        const wasCorrect = opt.correct === true;
        return {
          stored: { value, wasCorrect },
          reveal: {
            locked: true,
            wasCorrect,
            correctOptionId: correctOpt.id,
            coaching: correctOpt.coaching ?? null,
          },
        };
      }
    }
  }

  private isRequired(item: QuizItem): boolean {
    if (item.type === "info") return false;
    if (item.type === "text" && item.optional) return false;
    return true;
  }

  private isAnswered(item: QuizItem, stored: StoredAnswer | undefined): boolean {
    if (stored === undefined || stored === null) return false;
    const v = stored.value;
    switch (item.type) {
      case "multiselect":
        return Array.isArray(v);
      case "text":
        return typeof v === "string" && (item.optional || v.trim().length > 0);
      case "scale":
        return typeof v === "number";
      case "choice":
        return typeof v === "string" && v.length > 0;
      case "info":
        return true;
    }
  }

  /**
   * Complete the response: every required item visible under the final gate
   * answer must be answered → status Completed + a revision-stamped
   * TrainingRecords row (self-serve; find-or-reuse mirrors
   * sopAssessmentService.acknowledgeRead) → IT summary email.
   */
  async submit(responseId: number, userId: string) {
    const response = await this.requireOwned(responseId, userId);
    if (response.status !== "InProgress") throw new Error("INVALID_STATE");
    if (!response.revision.quizContent) throw new Error("QUIZ_NOT_READY");

    const doc = parseQuizDocument(response.revision.quizContent);
    const answers = JSON.parse(response.answers) as Record<string, StoredAnswer>;

    for (const { item } of visibleItems(doc, answers)) {
      if (!this.isRequired(item)) continue;
      if (!this.isAnswered(item, answers[item.id])) throw new Error("INCOMPLETE");
    }

    const trainingId = response.revision.trainingId;
    const completedAt = new Date();
    const today = startOfDay(completedAt);

    const existingRecord = await prisma.trainingRecords.findFirst({
      where: {
        employeeId: response.employeeId,
        trainingId,
        dateCompleted: { gte: today, lt: nextDay(today) },
      },
    });

    let recordId: number;
    if (existingRecord) {
      // Reuse-and-link in one transaction. trainingRecordId is @unique, so a
      // terminal response still holding this same-day record must release it
      // first, or the final update trips P2002. Post-restart: if the reused
      // record is our own self-completed row on a different revision, move the
      // stamp to the revision actually completed. Hand-entered records
      // (different trainer text) are linked untouched.
      const reused = existingRecord;
      await prisma.$transaction(async (tx) => {
        await tx.quizResponse.updateMany({
          where: { trainingRecordId: reused.id, id: { not: responseId } },
          data: { trainingRecordId: null },
        });
        if (
          reused.trainer === SELF_COMPLETED_TRAINER &&
          reused.revisionId !== response.revisionId
        ) {
          await tx.trainingRecords.update({
            where: { id: reused.id },
            data: { revisionId: response.revisionId },
          });
        }
        await tx.quizResponse.update({
          where: { id: responseId },
          data: { status: "Completed", completedAt, trainingRecordId: reused.id },
        });
      });
      recordId = reused.id;
    } else {
      const created = await prisma.trainingRecords.create({
        data: {
          employeeId: response.employeeId,
          trainingId,
          dateCompleted: today,
          trainer: SELF_COMPLETED_TRAINER,
          revisionId: response.revisionId,
        },
      });
      await prisma.history.create({
        data: {
          tableName: "TrainingRecords",
          recordId: created.id.toString(),
          action: "CREATE",
          newValues: JSON.stringify(created),
          userId,
        },
      });
      await prisma.quizResponse.update({
        where: { id: responseId },
        data: { status: "Completed", completedAt, trainingRecordId: created.id },
      });
      recordId = created.id;
    }

    await prisma.history.create({
      data: {
        tableName: "QuizResponse",
        recordId: responseId.toString(),
        action: "UPDATE",
        oldValues: JSON.stringify({ status: "InProgress" }),
        newValues: JSON.stringify({ status: "Completed", trainingRecordId: recordId }),
        userId,
      },
    });

    // Best-effort side effects: the completion is already committed, so neither
    // the evidence PDF nor the notification may surface to the caller (a retry
    // would hit INVALID_STATE and strand the response).
    try {
      await this.attachEvidencePdf({
        recordId,
        employeeId: response.employeeId,
        revisionId: response.revisionId,
        document: doc,
        answers,
        completedAt,
      });
    } catch (error) {
      console.error(
        `[quiz] evidence PDF generation failed for response ${responseId}:`,
        error,
      );
    }

    try {
      await this.notifySummary(response.employeeId, responseId);
    } catch (error) {
      console.error(
        `[quiz] summary notification failed for response ${responseId}:`,
        error,
      );
    }
  }

  /**
   * Render the completed questionnaire to a PDF and attach it to its
   * TrainingRecords row as evidence (served as a Certificate/Document via
   * /api/images). One evidence PDF per record: any prior auto-generated copy is
   * removed first so a restart-and-resubmit on the same day supersedes rather
   * than duplicates it. Hand-uploaded attachments are left untouched.
   */
  private async attachEvidencePdf(params: {
    recordId: number;
    employeeId: number;
    revisionId: number;
    document: QuizDocument;
    answers: Record<string, StoredAnswer>;
    completedAt: Date;
  }): Promise<void> {
    const [employee, revision] = await Promise.all([
      prisma.employee.findUnique({
        where: { id: params.employeeId },
        select: {
          preferredFirstName: true,
          legalFirstName: true,
          preferredLastName: true,
          legalLastName: true,
        },
      }),
      prisma.trainingRevision.findUnique({
        where: { id: params.revisionId },
        select: { revisionLabel: true, training: { select: { title: true } } },
      }),
    ]);
    if (!employee || !revision) return;

    const pdfBytes = await renderQuizResponsePdf({
      trainingTitle: revision.training.title,
      revisionLabel: revision.revisionLabel,
      employeeName: this.employeeName(employee),
      completedAt: params.completedAt,
      document: params.document,
      answers: params.answers,
    });

    // Replace any prior auto-generated evidence on this record.
    const stale = await prisma.trainingImage.findMany({
      where: { trainingRecordId: params.recordId, imageType: QUIZ_EVIDENCE_IMAGE_TYPE },
      select: { id: true, imagePath: true },
    });
    if (stale.length) {
      await prisma.trainingImage.deleteMany({
        where: { id: { in: stale.map((s) => s.id) } },
      });
      await fileUploadService.deleteFiles(stale.map((s) => s.imagePath));
    }

    const uploadDir = path.join(process.cwd(), "uploads", "training");
    if (!existsSync(uploadDir)) await mkdir(uploadDir, { recursive: true });
    const filename = `${uuidv4()}.pdf`;
    await writeFile(path.join(uploadDir, filename), Buffer.from(pdfBytes));

    await prisma.trainingImage.create({
      data: {
        trainingRecordId: params.recordId,
        imagePath: `training/${filename}`,
        imageType: QUIZ_EVIDENCE_IMAGE_TYPE,
        originalName: `${revision.training.title} Questionnaire.pdf`,
      },
    });
  }

  // ---- Player / read surfaces ----

  /** The pinned document with the answer key stripped — the only shape the
   * player GET returns to non-admins. */
  async getPlayerDocument(revisionId: number): Promise<QuizDocument> {
    const revision = await prisma.trainingRevision.findUnique({
      where: { id: revisionId },
      select: { quizContent: true },
    });
    if (!revision?.quizContent) throw new Error("QUIZ_NOT_READY");
    return stripAnswerKey(parseQuizDocument(revision.quizContent));
  }

  /**
   * The follow-up sheet IT reads during the tailored intro: gate answer,
   * self-assessment ratings, flagged knowledge items (using the stored
   * wasCorrect — never recomputed), free-text verbatim, and suggested coaching
   * topics. Computed only over items visible under the final gate answer;
   * lingering hidden-branch answers are ignored.
   */
  async buildSummary(responseId: number) {
    const response = await prisma.quizResponse.findUnique({
      where: { id: responseId },
      include: {
        employee: {
          select: {
            id: true,
            preferredFirstName: true,
            legalFirstName: true,
            preferredLastName: true,
            legalLastName: true,
          },
        },
        revision: {
          select: {
            id: true,
            revisionLabel: true,
            trainingId: true,
            quizContent: true,
            training: { select: { id: true, title: true } },
          },
        },
      },
    });
    if (!response) throw new Error("RESPONSE_NOT_FOUND");
    if (!response.revision.quizContent) throw new Error("QUIZ_NOT_READY");

    const doc = parseQuizDocument(response.revision.quizContent);
    const answers = JSON.parse(response.answers) as Record<string, StoredAnswer>;
    const gateItemIds = new Set(
      doc.sections.flatMap((s) => (s.showIf ? [s.showIf.itemId] : [])),
    );

    const gate: { prompt: string; answerLabel: string }[] = [];
    const selfAssessment: { prompt: string; ratingLabel: string }[] = [];
    const flagged: {
      prompt: string;
      pickedLabel: string;
      coachedLabel: string;
      coaching: string | null;
    }[] = [];
    const freeText: { prompt: string; value: string }[] = [];

    for (const { item } of visibleItems(doc, answers)) {
      const stored = answers[item.id];
      switch (item.type) {
        case "info":
          break;
        case "scale": {
          const idx = stored?.value;
          if (typeof idx === "number" && item.scaleLabels[idx] !== undefined) {
            selfAssessment.push({ prompt: item.prompt, ratingLabel: item.scaleLabels[idx] });
          }
          break;
        }
        case "multiselect": {
          const picked = Array.isArray(stored?.value) ? (stored?.value as string[]) : [];
          const labels = picked
            .map((id) => item.options.find((o) => o.id === id)?.label)
            .filter((l): l is string => Boolean(l));
          selfAssessment.push({
            prompt: item.prompt,
            ratingLabel: labels.length ? labels.join(", ") : "(none)",
          });
          break;
        }
        case "text": {
          const v = typeof stored?.value === "string" ? (stored.value as string) : "";
          if (v.trim()) freeText.push({ prompt: item.prompt, value: v });
          break;
        }
        case "choice": {
          const correctOpt = item.options.find((o) => o.correct);
          const pickedOpt = item.options.find((o) => o.id === stored?.value);
          if (!correctOpt) {
            // Gate / survey choice. Skip when there is no valid stored pick: an
            // in-progress response, or one whose gate answer was changed
            // mid-quiz (going back), can leave a visible choice unanswered, and
            // a "(unanswered)" placeholder is just noise on the IT follow-up
            // sheet. Completed responses always have every visible choice
            // answered, so this only prunes partial views.
            if (!pickedOpt) break;
            if (gateItemIds.has(item.id)) {
              gate.push({ prompt: item.prompt, answerLabel: pickedOpt.label });
            } else {
              selfAssessment.push({ prompt: item.prompt, ratingLabel: pickedOpt.label });
            }
            break;
          }
          // Knowledge item: flag when the stored, point-in-time verdict is wrong.
          if (stored?.wasCorrect === false && pickedOpt) {
            flagged.push({
              prompt: item.prompt,
              pickedLabel: pickedOpt.label,
              coachedLabel: correctOpt.label,
              coaching: correctOpt.coaching ?? null,
            });
          }
          break;
        }
      }
    }

    const employeeName = this.employeeName(response.employee);

    return {
      responseId: response.id,
      employeeName,
      trainingTitle: response.revision.training.title,
      revisionLabel: response.revision.revisionLabel,
      completedAt: response.completedAt,
      gate,
      selfAssessment,
      flagged,
      freeText,
      coachingTopics: flagged.map((f) => f.prompt),
    };
  }

  private employeeName(employee: {
    preferredFirstName: string | null;
    legalFirstName: string;
    preferredLastName: string | null;
    legalLastName: string;
  }): string {
    return `${employee.preferredFirstName ?? employee.legalFirstName} ${employee.preferredLastName ?? employee.legalLastName}`;
  }

  /** Summary email to the configured IT recipient; falls back to Admins. */
  private async notifySummary(employeeId: number, responseId: number) {
    const setting = await prisma.appSetting.findUnique({
      where: { key: "it.quizSummaryEmail" },
    });
    const configured = setting?.value?.trim();

    let recipients: string[];
    if (configured) {
      recipients = [configured];
    } else {
      const admins = await prisma.user.findMany({
        where: { role: "Admin", email: { not: null } },
        select: { email: true },
      });
      recipients = admins.map((a) => a.email as string);
    }
    if (recipients.length === 0) return;

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        preferredFirstName: true,
        legalFirstName: true,
        preferredLastName: true,
        legalLastName: true,
      },
    });
    const employeeName = employee ? this.employeeName(employee) : "A new starter";
    const summaryUrl = appLink(`/admin/quiz-results/${responseId}`);

    const { subject, body } = await emailTemplateService.render("it.quizSummary", {
      employeeName,
      summaryUrl,
    });
    // Lazy import: mailService pulls "server-only", which would otherwise be
    // dragged into every module that imports quizService (e.g.
    // trainingRevisionService) and break their test loads.
    const { mailService } = await import("@/lib/services/mailService");
    await mailService.send({ to: recipients, subject, html: body });
  }

  // ---- Admin list surfaces ----

  /** Completed responses newest-first, optionally filtered by training. */
  async listCompleted(trainingId?: number) {
    return prisma.quizResponse.findMany({
      where: {
        status: "Completed",
        ...(trainingId ? { revision: { trainingId } } : {}),
      },
      include: {
        employee: {
          select: {
            id: true,
            preferredFirstName: true,
            legalFirstName: true,
            preferredLastName: true,
            legalLastName: true,
          },
        },
        revision: {
          select: {
            id: true,
            revisionLabel: true,
            trainingId: true,
            training: { select: { id: true, title: true } },
          },
        },
      },
      orderBy: { completedAt: "desc" },
    });
  }

  /**
   * The caller's assigned interactive questionnaires: required (via
   * TrainingRequirement, wildcard `-1` included) non-SOP trainings whose current
   * revision carries quiz content, each with the employee's latest response
   * status. Drives the self-serve entry surface.
   */
  async listAssigned(userId: string) {
    const employeeId = await this.requireLinkedEmployeeId(userId);
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { departmentId: true, locationId: true },
    });
    if (!employee) throw new Error("EMPLOYEE_NOT_FOUND");

    const requirements = await prisma.trainingRequirement.findMany({
      where: {
        OR: [
          { departmentId: employee.departmentId, locationId: employee.locationId },
          { departmentId: -1, locationId: employee.locationId },
          { departmentId: employee.departmentId, locationId: -1 },
          { departmentId: -1, locationId: -1 },
        ],
        training: { isActive: true, category: { not: "SOP" } },
      },
      select: { training: { select: { id: true, title: true } } },
    });

    const byId = new Map<number, string>();
    for (const r of requirements) byId.set(r.training.id, r.training.title);

    const rows: {
      trainingId: number;
      title: string;
      currentRevisionId: number;
      response: { id: number; status: string; onCurrentRevision: boolean } | null;
    }[] = [];

    for (const [trainingId, title] of byId) {
      const cur = await this.currentRevisionOf(trainingId);
      if (!cur) continue;
      const rev = await prisma.trainingRevision.findUnique({
        where: { id: cur.id },
        select: { quizContent: true },
      });
      if (!rev?.quizContent) continue; // not interactive

      const response = await prisma.quizResponse.findFirst({
        where: { employeeId, revision: { trainingId } },
        orderBy: { startedAt: "desc" },
        select: { id: true, status: true, revisionId: true },
      });

      rows.push({
        trainingId,
        title,
        currentRevisionId: cur.id,
        response: response
          ? {
              id: response.id,
              status: response.status,
              onCurrentRevision: response.revisionId === cur.id,
            }
          : null,
      });
    }

    return rows.sort((a, b) => a.title.localeCompare(b.title));
  }

  /** The caller's own responses (the self-serve surface). */
  async listMine(userId: string) {
    const employeeId = await this.requireLinkedEmployeeId(userId);
    return prisma.quizResponse.findMany({
      where: { employeeId },
      include: {
        revision: {
          select: {
            id: true,
            revisionLabel: true,
            trainingId: true,
            training: { select: { id: true, title: true } },
          },
        },
      },
      orderBy: [{ status: "asc" }, { startedAt: "desc" }],
    });
  }

  /**
   * Full response for the player (owner) or the results detail (owner|Admin).
   * The document is answer-key-stripped for the owner; Admins get the summary.
   */
  async getForActor(responseId: number, userId: string, role: string) {
    const response = await prisma.quizResponse.findUnique({
      where: { id: responseId },
      include: {
        employee: {
          select: {
            id: true,
            preferredFirstName: true,
            legalFirstName: true,
            preferredLastName: true,
            legalLastName: true,
          },
        },
        revision: {
          select: {
            id: true,
            revisionLabel: true,
            trainingId: true,
            quizContent: true,
            training: { select: { id: true, title: true } },
          },
        },
      },
    });
    if (!response) throw new Error("RESPONSE_NOT_FOUND");
    if (!response.revision.quizContent) throw new Error("QUIZ_NOT_READY");

    const employeeId = await this.linkedEmployeeId(userId);
    const isOwner = employeeId !== null && response.employeeId === employeeId;
    const isAdmin = role === "Admin";
    if (!isOwner && !isAdmin) throw new Error("NOT_AUTHORISED");

    const cur = await this.currentRevisionOf(response.revision.trainingId);
    const answers = JSON.parse(response.answers) as Record<string, StoredAnswer>;
    const fullDoc = parseQuizDocument(response.revision.quizContent);

    // Reveals for the OWNER cover only already-locked items (choice items with a
    // correct option they have committed to). Unanswered items stay stripped, so
    // the answer key never reaches the browser before the employee commits.
    const reveals: Record<
      string,
      { correctOptionId: string; coaching: string | null; wasCorrect: boolean }
    > = {};
    if (isOwner) {
      for (const [itemId, ans] of Object.entries(answers)) {
        if (!ans || ans.wasCorrect === undefined) continue;
        const item = this.findItem(fullDoc, itemId);
        if (item?.type === "choice") {
          const correctOpt = item.options.find((o) => o.correct);
          if (correctOpt) {
            reveals[itemId] = {
              correctOptionId: correctOpt.id,
              coaching: correctOpt.coaching ?? null,
              wasCorrect: ans.wasCorrect,
            };
          }
        }
      }
    }

    return {
      id: response.id,
      status: response.status,
      startedAt: response.startedAt,
      completedAt: response.completedAt,
      revisionId: response.revisionId,
      trainingId: response.revision.trainingId,
      trainingTitle: response.revision.training.title,
      onCurrentRevision: cur?.id === response.revisionId,
      employee: response.employee,
      // Owner never sees the answer key (except reveals for locked items);
      // Admin gets the full document + summary.
      document: isAdmin ? fullDoc : stripAnswerKey(fullDoc),
      answers,
      reveals,
      summary: isAdmin ? await this.buildSummary(responseId) : null,
      viewer: { isOwner, isAdmin },
    };
  }
}

export const quizService = new QuizService();
