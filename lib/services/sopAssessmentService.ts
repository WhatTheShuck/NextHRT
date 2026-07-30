import prisma from "@/lib/prisma";
import { currentRevision } from "@/lib/services/trainingCompliance";
import { sopService } from "@/lib/services/sopService";
import { emailTemplateService } from "@/lib/services/emailTemplateService";
import { mailService } from "@/lib/services/mailService";

export const NON_TERMINAL_STATUSES = ["InProgress", "Submitted", "ChangesRequested"];

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

class SopAssessmentService {
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

  /** Current revision of a training, or null. */
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

  /**
   * Start (or resume) an assessment. Enforces the invariant: at most one
   * non-terminal assessment per employee per SOP — an existing one is
   * returned instead of creating a second.
   */
  async start(userId: string, taskSheetTrainingId: number) {
    const employeeId = await this.requireLinkedEmployeeId(userId);

    const pair = await sopService.resolvePair(taskSheetTrainingId);
    if (!pair || pair.taskSheetId !== taskSheetTrainingId) {
      throw new Error("NOT_A_TASK_SHEET");
    }

    const existing = await prisma.sopAssessment.findFirst({
      where: {
        employeeId,
        status: { in: NON_TERMINAL_STATUSES },
        revision: { trainingId: taskSheetTrainingId },
      },
    });
    if (existing) return existing;

    const cur = await this.currentRevisionOf(taskSheetTrainingId);
    if (!cur) throw new Error("SOP_NOT_READY");
    const revision = await prisma.trainingRevision.findUnique({
      where: { id: cur.id },
      select: { id: true, trainingId: true, documentPath: true },
    });
    if (!revision?.documentPath) throw new Error("SOP_NOT_READY");
    const questionCount = await prisma.sopQuestion.count({
      where: { revisionId: cur.id },
    });
    if (questionCount === 0) throw new Error("SOP_NOT_READY");

    const created = await prisma.sopAssessment.create({
      data: { employeeId, revisionId: cur.id, status: "InProgress" },
    });

    await prisma.history.create({
      data: {
        tableName: "SopAssessment",
        recordId: created.id.toString(),
        action: "CREATE",
        newValues: JSON.stringify(created),
        userId,
      },
    });

    return created;
  }

  /**
   * Supersede a stale non-terminal assessment and start fresh on the
   * current revision (one transaction — never leaves a dangling row).
   */
  async restart(assessmentId: number, userId: string) {
    const employeeId = await this.requireLinkedEmployeeId(userId);
    const assessment = await prisma.sopAssessment.findUnique({
      where: { id: assessmentId },
      include: { revision: { select: { trainingId: true } } },
    });
    if (!assessment) throw new Error("ASSESSMENT_NOT_FOUND");
    if (assessment.employeeId !== employeeId) throw new Error("NOT_AUTHORISED");
    if (!NON_TERMINAL_STATUSES.includes(assessment.status)) {
      throw new Error("INVALID_STATE");
    }

    const trainingId = assessment.revision.trainingId;
    const cur = await this.currentRevisionOf(trainingId);
    if (!cur) throw new Error("SOP_NOT_READY");
    const revision = await prisma.trainingRevision.findUnique({
      where: { id: cur.id },
      select: { id: true, trainingId: true, documentPath: true },
    });
    if (!revision?.documentPath) throw new Error("SOP_NOT_READY");
    const questionCount = await prisma.sopQuestion.count({
      where: { revisionId: cur.id },
    });
    if (questionCount === 0) throw new Error("SOP_NOT_READY");

    // Release the record link (taskSheetRecordId is @unique): the new
    // assessment must re-acknowledge the current revision, and its
    // find-or-reuse would otherwise trip P2002 on the same-day record.
    const created = await prisma.$transaction(async (tx) => {
      await tx.sopAssessment.update({
        where: { id: assessmentId },
        data: { status: "Superseded", taskSheetRecordId: null },
      });
      return tx.sopAssessment.create({
        data: {
          employeeId,
          revisionId: cur.id,
          status: "InProgress",
          taskSheetRecordId: null,
        },
      });
    });

    await prisma.history.create({
      data: {
        tableName: "SopAssessment",
        recordId: assessmentId.toString(),
        action: "UPDATE",
        oldValues: JSON.stringify({ status: assessment.status }),
        newValues: JSON.stringify({ status: "Superseded", replacedBy: created.id }),
        userId,
      },
    });

    return created;
  }

  /** Load an assessment and assert the caller owns it. */
  private async requireOwned(assessmentId: number, userId: string) {
    const employeeId = await this.requireLinkedEmployeeId(userId);
    const assessment = await prisma.sopAssessment.findUnique({
      where: { id: assessmentId },
      include: { revision: { select: { trainingId: true } } },
    });
    if (!assessment) throw new Error("ASSESSMENT_NOT_FOUND");
    if (assessment.employeeId !== employeeId) throw new Error("NOT_AUTHORISED");
    return assessment;
  }

  async saveAnswers(
    assessmentId: number,
    userId: string,
    answers: Array<{ questionId: number; answerText: string }>,
  ) {
    const assessment = await this.requireOwned(assessmentId, userId);
    if (assessment.status !== "InProgress" && assessment.status !== "ChangesRequested") {
      throw new Error("INVALID_STATE");
    }

    const questions = await prisma.sopQuestion.findMany({
      where: { revisionId: assessment.revisionId },
      select: { id: true },
    });
    const validIds = new Set(questions.map((q) => q.id));

    const existingAnswers = await prisma.sopAnswer.findMany({
      where: { assessmentId },
      select: { questionId: true, verdict: true },
    });
    const verdictByQuestion = new Map(
      existingAnswers.map((a) => [a.questionId, a.verdict]),
    );

    for (const answer of answers) {
      if (!validIds.has(answer.questionId)) throw new Error("INVALID_QUESTION");
      if (
        assessment.status === "ChangesRequested" &&
        verdictByQuestion.get(answer.questionId) !== "Insufficient"
      ) {
        // Only answers the trainer marked insufficient unlock for editing.
        throw new Error("ANSWER_LOCKED");
      }
    }

    for (const answer of answers) {
      await prisma.sopAnswer.upsert({
        where: {
          assessmentId_questionId: { assessmentId, questionId: answer.questionId },
        },
        create: {
          assessmentId,
          questionId: answer.questionId,
          answerText: answer.answerText,
        },
        // Editing an answer clears its verdict + comment (spec: resubmit
        // semantics — the trainer re-marks only what changed).
        update: { answerText: answer.answerText, verdict: null, trainerComment: null },
      });
    }
  }

  /**
   * Read-acknowledgement → Task Sheet TrainingRecords row, revision-stamped.
   * Idempotent; find-or-reuse guards the (employeeId, trainingId, dateCompleted)
   * unique constraint against same-day hand-entered or restarted records.
   */
  async acknowledgeRead(assessmentId: number, userId: string) {
    const assessment = await this.requireOwned(assessmentId, userId);
    if (!NON_TERMINAL_STATUSES.includes(assessment.status)) {
      throw new Error("INVALID_STATE");
    }
    if (assessment.taskSheetRecordId !== null) return assessment;

    const trainingId = assessment.revision.trainingId;
    const today = startOfDay(new Date());

    let record = await prisma.trainingRecords.findFirst({
      where: {
        employeeId: assessment.employeeId,
        trainingId,
        dateCompleted: { gte: today, lt: nextDay(today) },
      },
    });

    if (record) {
      // Reuse-and-link in one transaction. taskSheetRecordId is @unique, so a
      // terminal assessment (Passed/Superseded) that still owns this same-day
      // record must release its link before we claim it, or the final update
      // trips P2002. Releasing is safe: a terminal assessment with a null record
      // is historical evidence only — current compliance comes from
      // TrainingRecords, and the record itself is untouched.
      const reused = record;
      await prisma.$transaction(async (tx) => {
        await tx.sopAssessment.updateMany({
          where: { taskSheetRecordId: reused.id, id: { not: assessmentId } },
          data: { taskSheetRecordId: null },
        });
        // Post-restart: a same-day record created by the superseded assessment
        // carries the old revision stamp. It is our own self-ack record, so
        // move the stamp to the revision the employee actually re-read.
        // Hand-entered records (different trainer text) are linked untouched.
        if (
          reused.trainer === "Self-acknowledged (HRT)" &&
          reused.revisionId !== assessment.revisionId
        ) {
          await tx.trainingRecords.update({
            where: { id: reused.id },
            data: { revisionId: assessment.revisionId },
          });
        }
        await tx.sopAssessment.update({
          where: { id: assessmentId },
          data: { taskSheetRecordId: reused.id },
        });
      });

      return { ...assessment, taskSheetRecordId: reused.id };
    }

    record = await prisma.trainingRecords.create({
      data: {
        employeeId: assessment.employeeId,
        trainingId,
        dateCompleted: today,
        trainer: "Self-acknowledged (HRT)",
        revisionId: assessment.revisionId,
      },
    });
    await prisma.history.create({
      data: {
        tableName: "TrainingRecords",
        recordId: record.id.toString(),
        action: "CREATE",
        newValues: JSON.stringify(record),
        userId,
      },
    });

    await prisma.sopAssessment.update({
      where: { id: assessmentId },
      data: { taskSheetRecordId: record.id },
    });

    return { ...assessment, taskSheetRecordId: record.id };
  }

  async submit(assessmentId: number, userId: string) {
    const assessment = await this.requireOwned(assessmentId, userId);
    if (assessment.status !== "InProgress" && assessment.status !== "ChangesRequested") {
      throw new Error("INVALID_STATE");
    }

    const questions = await prisma.sopQuestion.findMany({
      where: { revisionId: assessment.revisionId },
      select: { id: true },
    });
    const answers = await prisma.sopAnswer.findMany({
      where: { assessmentId },
      select: { questionId: true, answerText: true },
    });
    const answered = new Map(answers.map((a) => [a.questionId, a.answerText]));
    for (const q of questions) {
      if (!answered.get(q.id)?.trim()) throw new Error("INCOMPLETE_ANSWERS");
    }

    await prisma.sopAssessment.update({
      where: { id: assessmentId },
      data: { status: "Submitted", submittedAt: new Date() },
    });

    await prisma.history.create({
      data: {
        tableName: "SopAssessment",
        recordId: assessmentId.toString(),
        action: "UPDATE",
        oldValues: JSON.stringify({ status: assessment.status }),
        newValues: JSON.stringify({ status: "Submitted" }),
        userId,
      },
    });

    // Best-effort delivery: the state transition is already committed, so a
    // notification failure must never surface to the caller (a retry would hit
    // INVALID_STATE and strand the assessment).
    try {
      await this.notifySubmitted(assessment.revision.trainingId, assessment.employeeId);
    } catch (err) {
      console.error(
        `[sopAssessment] submit notification failed for assessment ${assessmentId}:`,
        err,
      );
    }
  }

  /** Trainer emails; falls back to Admin users when no trainer is reachable. */
  private async notifySubmitted(taskSheetTrainingId: number, employeeId: number) {
    const assignments = await prisma.sopTrainerAssignment.findMany({
      where: { trainingId: taskSheetTrainingId },
      include: { employee: { select: { User: { select: { email: true } } } } },
    });
    let recipients = assignments
      .map((a) => a.employee.User?.email)
      .filter((e): e is string => Boolean(e));

    if (recipients.length === 0) {
      const admins = await prisma.user.findMany({
        where: { role: "Admin", email: { not: null } },
        select: { email: true },
      });
      recipients = admins.map((a) => a.email as string);
    }
    if (recipients.length === 0) return;

    const training = await prisma.training.findUnique({
      where: { id: taskSheetTrainingId },
      select: { id: true, title: true },
    });
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        preferredFirstName: true,
        legalFirstName: true,
        preferredLastName: true,
        legalLastName: true,
      },
    });
    const employeeName = employee
      ? `${employee.preferredFirstName ?? employee.legalFirstName} ${employee.preferredLastName ?? employee.legalLastName}`
      : "An employee";
    const sopTitle = (training?.title ?? "SOP").replace(/ - Task Sheet$/, "");

    // null = template switched off in the admin editor; skip the send.
    const rendered = await emailTemplateService.render("sop.submitted", {
      sopTitle,
      employeeName,
    });
    if (!rendered) return;

    await mailService.send({
      to: recipients,
      subject: rendered.subject,
      html: rendered.body,
    });
  }

  /** Admin, or a designated trainer (via their linked employee) for this SOP. */
  private async canMark(userId: string, role: string, taskSheetTrainingId: number) {
    if (role === "Admin") return true;
    const employeeId = await this.linkedEmployeeId(userId);
    if (employeeId === null) return false;
    const assignment = await prisma.sopTrainerAssignment.findUnique({
      where: {
        trainingId_employeeId: { trainingId: taskSheetTrainingId, employeeId },
      },
    });
    return assignment !== null;
  }

  async mark(
    assessmentId: number,
    userId: string,
    role: string,
    input: {
      action: "pass" | "requestChanges";
      verdicts: Array<{
        answerId: number;
        verdict: "Sufficient" | "Insufficient";
        trainerComment?: string;
      }>;
    },
  ) {
    const assessment = await prisma.sopAssessment.findUnique({
      where: { id: assessmentId },
      include: { revision: { select: { trainingId: true } } },
    });
    if (!assessment) throw new Error("ASSESSMENT_NOT_FOUND");

    const taskSheetTrainingId = assessment.revision.trainingId;
    if (!(await this.canMark(userId, role, taskSheetTrainingId))) {
      throw new Error("NOT_AUTHORISED");
    }
    if (assessment.status !== "Submitted") throw new Error("INVALID_STATE");

    // Apply the incoming verdicts (persisted Sufficient verdicts from a
    // previous round stay as they are — the trainer re-marks only cleared ones).
    // Deliberate: verdict writes land before the action is validated, so a
    // rejected pass/requestChanges keeps the trainer's selections. The
    // assessment stays Submitted, so nothing is inconsistent — the next mark
    // attempt starts from the saved verdicts.
    const answers = await prisma.sopAnswer.findMany({
      where: { assessmentId },
      select: { id: true, questionId: true, verdict: true },
    });
    const answerIds = new Set(answers.map((a) => a.id));
    for (const v of input.verdicts) {
      if (!answerIds.has(v.answerId)) throw new Error("INVALID_ANSWER");
      await prisma.sopAnswer.update({
        where: { id: v.answerId },
        data: { verdict: v.verdict, trainerComment: v.trainerComment ?? null },
      });
    }

    // Re-read the effective verdict set and validate the action.
    const effective = new Map(answers.map((a) => [a.id, a.verdict]));
    for (const v of input.verdicts) effective.set(v.answerId, v.verdict);
    const verdicts = [...effective.values()];
    if (verdicts.some((v) => v === null)) throw new Error("MISSING_VERDICTS");
    const anyInsufficient = verdicts.some((v) => v === "Insufficient");
    if (input.action === "pass" && anyInsufficient) throw new Error("VERDICT_MISMATCH");
    if (input.action === "requestChanges" && !anyInsufficient) {
      throw new Error("VERDICT_MISMATCH");
    }

    const marker = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });
    const now = new Date();

    if (input.action === "requestChanges") {
      await prisma.sopAssessment.update({
        where: { id: assessmentId },
        data: { status: "ChangesRequested", markedAt: now, markedByUserId: userId },
      });
      await prisma.history.create({
        data: {
          tableName: "SopAssessment",
          recordId: assessmentId.toString(),
          action: "UPDATE",
          oldValues: JSON.stringify({ status: "Submitted" }),
          newValues: JSON.stringify({ status: "ChangesRequested" }),
          userId,
        },
      });
      // Best-effort delivery — see submit(): never let a notification failure
      // surface after the transition has committed.
      try {
        await this.notifyEmployee(
          assessment.employeeId,
          taskSheetTrainingId,
          "sop.changesRequested",
          marker?.name ?? "Your trainer",
        );
      } catch (err) {
        console.error(
          `[sopAssessment] changesRequested notification failed for assessment ${assessmentId}:`,
          err,
        );
      }
      return;
    }

    // Pass: create the Practical TrainingRecords row.
    const pair = await sopService.resolvePair(taskSheetTrainingId);
    if (!pair) throw new Error("NOT_AN_SOP_PAIR");
    const practicalCurrent = await this.currentRevisionOf(pair.practicalId);

    const today = startOfDay(now);
    let record = await prisma.trainingRecords.findFirst({
      where: {
        employeeId: assessment.employeeId,
        trainingId: pair.practicalId,
        dateCompleted: { gte: today, lt: nextDay(today) },
      },
    });
    if (!record) {
      record = await prisma.trainingRecords.create({
        data: {
          employeeId: assessment.employeeId,
          trainingId: pair.practicalId,
          dateCompleted: today,
          trainer: marker?.name ?? "HRT",
          revisionId: practicalCurrent?.id ?? null,
        },
      });
      await prisma.history.create({
        data: {
          tableName: "TrainingRecords",
          recordId: record.id.toString(),
          action: "CREATE",
          newValues: JSON.stringify(record),
          userId,
        },
      });
    }

    await prisma.sopAssessment.update({
      where: { id: assessmentId },
      data: {
        status: "Passed",
        markedAt: now,
        markedByUserId: userId,
        practicalRecordId: record.id,
      },
    });
    await prisma.history.create({
      data: {
        tableName: "SopAssessment",
        recordId: assessmentId.toString(),
        action: "UPDATE",
        oldValues: JSON.stringify({ status: "Submitted" }),
        newValues: JSON.stringify({ status: "Passed", practicalRecordId: record.id }),
        userId,
      },
    });

    // Best-effort delivery — see submit(): never let a notification failure
    // surface after the Pass (and Practical record) have committed.
    try {
      await this.notifyEmployee(
        assessment.employeeId,
        taskSheetTrainingId,
        "sop.passed",
        marker?.name ?? "Your trainer",
      );
    } catch (err) {
      console.error(
        `[sopAssessment] passed notification failed for assessment ${assessmentId}:`,
        err,
      );
    }
  }

  private async notifyEmployee(
    employeeId: number,
    taskSheetTrainingId: number,
    templateKey: "sop.changesRequested" | "sop.passed",
    trainerName: string,
  ) {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        preferredFirstName: true,
        legalFirstName: true,
        preferredLastName: true,
        legalLastName: true,
        User: { select: { email: true } },
      },
    });
    const email = employee?.User?.email;
    if (!email) return; // no linked account — nothing to send

    const training = await prisma.training.findUnique({
      where: { id: taskSheetTrainingId },
      select: { title: true },
    });
    const employeeName = `${employee.preferredFirstName ?? employee.legalFirstName} ${employee.preferredLastName ?? employee.legalLastName}`;
    const sopTitle = (training?.title ?? "SOP").replace(/ - Task Sheet$/, "");

    const rendered = await emailTemplateService.render(templateKey, {
      sopTitle,
      employeeName,
      trainerName,
    });
    if (!rendered) return;

    await mailService.send({
      to: email,
      subject: rendered.subject,
      html: rendered.body,
    });
  }

  /** Submitted assessments this user may mark, oldest first. */
  async listQueue(userId: string, role: string) {
    const include = {
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
          training: { select: { title: true } },
        },
      },
    } as const;
    const orderBy = { submittedAt: "asc" } as const;

    if (role === "Admin") {
      return prisma.sopAssessment.findMany({
        where: { status: "Submitted" },
        include,
        orderBy,
      });
    }

    const employeeId = await this.linkedEmployeeId(userId);
    if (employeeId === null) return [];
    const assignments = await prisma.sopTrainerAssignment.findMany({
      where: { employeeId },
      select: { trainingId: true },
    });
    if (assignments.length === 0) return [];

    return prisma.sopAssessment.findMany({
      where: {
        status: "Submitted",
        revision: { trainingId: { in: assignments.map((a) => a.trainingId) } },
      },
      include,
      orderBy,
    });
  }

  /**
   * "My SOPs": required SOP pairs for the caller's linked employee, with
   * record status + active assessment. Rows come from TrainingRequirement
   * for the employee's department/location, Task Sheet side only.
   */
  async listMine(userId: string) {
    const employeeId = await this.requireLinkedEmployeeId(userId);
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { departmentId: true, locationId: true },
    });
    if (!employee) throw new Error("EMPLOYEE_NOT_FOUND");

    const requirements = await prisma.trainingRequirement.findMany({
      where: {
        // -1 is the "all departments" / "all locations" wildcard — same four-way
        // match requirementService.getEmployeeRequirements uses.
        OR: [
          { departmentId: employee.departmentId, locationId: employee.locationId },
          { departmentId: -1, locationId: employee.locationId },
          { departmentId: employee.departmentId, locationId: -1 },
          { departmentId: -1, locationId: -1 },
        ],
        training: {
          category: "SOP",
          isActive: true,
          // A requirement on either half means the SOP is required: the two
          // Training rows are edited independently and their department sets
          // do drift in practice.
          OR: [
            { sopPartnerId: { not: null } }, // this row is the Task Sheet
            { sopPartnerOf: { isNot: null } }, // this row is the Practical
          ],
        },
      },
      include: {
        training: {
          select: {
            id: true,
            title: true,
            sopPartnerId: true,
            sopPartnerOf: { select: { id: true, title: true, isActive: true } },
          },
        },
      },
    });

    // Normalise every hit to its Task Sheet half and dedupe — one pair can
    // arrive twice (both halves required) or via several wildcard rows.
    const pairs = new Map<number, { taskSheetId: number; title: string; practicalId: number }>();
    for (const { training } of requirements) {
      if (training.sopPartnerId !== null) {
        pairs.set(training.id, {
          taskSheetId: training.id,
          title: training.title,
          practicalId: training.sopPartnerId,
        });
        continue;
      }
      const taskSheet = training.sopPartnerOf;
      // The Task Sheet owns the content and revisions — a deactivated one
      // can't be taken, whatever the Practical's requirements say.
      if (!taskSheet || !taskSheet.isActive) continue;
      pairs.set(taskSheet.id, {
        taskSheetId: taskSheet.id,
        title: taskSheet.title,
        practicalId: training.id,
      });
    }

    const taskSheetIds = [...pairs.values()].map((p) => p.taskSheetId);
    const practicalIds = [...pairs.values()].map((p) => p.practicalId);

    const records = await prisma.trainingRecords.findMany({
      where: {
        employeeId,
        trainingId: { in: [...taskSheetIds, ...practicalIds] },
      },
      select: { trainingId: true },
    });
    const recordedTrainingIds = new Set(records.map((r) => r.trainingId));

    const active = await prisma.sopAssessment.findMany({
      where: {
        employeeId,
        status: { in: NON_TERMINAL_STATUSES },
        revision: { trainingId: { in: taskSheetIds } },
      },
      select: { id: true, status: true, revisionId: true, revision: { select: { trainingId: true } } },
    });
    const activeByTraining = new Map(active.map((a) => [a.revision.trainingId, a]));

    const rows = [];
    for (const { taskSheetId, practicalId, title } of pairs.values()) {
      const cur = await this.currentRevisionOf(taskSheetId);
      let ready = false;
      if (cur) {
        const revision = await prisma.trainingRevision.findUnique({
          where: { id: cur.id },
          select: { documentPath: true },
        });
        const questionCount = await prisma.sopQuestion.count({
          where: { revisionId: cur.id },
        });
        ready = Boolean(revision?.documentPath) && questionCount > 0;
      }
      const assessment = activeByTraining.get(taskSheetId) ?? null;
      rows.push({
        taskSheetId,
        title: title.replace(/ - Task Sheet$/, ""),
        taskSheetDone: recordedTrainingIds.has(taskSheetId),
        practicalDone: recordedTrainingIds.has(practicalId),
        ready,
        currentRevisionId: cur?.id ?? null,
        assessment: assessment
          ? {
              id: assessment.id,
              status: assessment.status,
              revisionId: assessment.revisionId,
              onCurrentRevision: assessment.revisionId === cur?.id,
            }
          : null,
      });
    }
    return rows.sort((a, b) => a.title.localeCompare(b.title));
  }

  /**
   * Full assessment for the taking/marking views. Owner, designated trainer,
   * or Admin only; markerNotes stripped for the owner.
   */
  async getForActor(assessmentId: number, userId: string, role: string) {
    const assessment = await prisma.sopAssessment.findUnique({
      where: { id: assessmentId },
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
            documentPath: true,
            training: { select: { id: true, title: true } },
            sopQuestions: { orderBy: { order: "asc" } },
          },
        },
        answers: true,
        // marker's name for the evidence export (record.trainer = marker)
        practicalRecord: { select: { trainer: true } },
      },
    });
    if (!assessment) throw new Error("ASSESSMENT_NOT_FOUND");

    const employeeId = await this.linkedEmployeeId(userId);
    const isOwner = employeeId !== null && assessment.employeeId === employeeId;
    const canMark = await this.canMark(userId, role, assessment.revision.trainingId);
    if (!isOwner && !canMark) throw new Error("NOT_AUTHORISED");

    const currentOfTraining = await this.currentRevisionOf(assessment.revision.trainingId);

    return {
      ...assessment,
      revision: {
        ...assessment.revision,
        sopQuestions: assessment.revision.sopQuestions.map((q) => ({
          ...q,
          markerNotes: canMark ? q.markerNotes : null,
        })),
      },
      viewer: { isOwner, canMark },
      onCurrentRevision: currentOfTraining?.id === assessment.revisionId,
    };
  }

  /**
   * SOPs this employee completed **in HRT**: a Passed assessment that still
   * owns both TrainingRecords halves. Paper-era completions have no assessment
   * and deliberately never appear here — there is no answer data to show.
   */
  async listCompletedForEmployee(employeeId: number) {
    const assessments = await prisma.sopAssessment.findMany({
      where: {
        employeeId,
        status: "Passed",
        taskSheetRecordId: { not: null },
        practicalRecordId: { not: null },
      },
      select: {
        id: true,
        markedAt: true,
        revision: { select: { trainingId: true } },
      },
      orderBy: { markedAt: "desc" },
    });
    return assessments.map((a) => ({
      assessmentId: a.id,
      taskSheetTrainingId: a.revision.trainingId,
      markedAt: a.markedAt,
    }));
  }

  /**
   * Everything the completion record shows, on screen and in the PDF: the
   * questions as answered and marked, the employee's read-acknowledgement, and
   * the trainer sign-off. Only a Passed assessment with both records has one.
   */
  async getCompletionEvidence(assessmentId: number) {
    const assessment = await prisma.sopAssessment.findUnique({
      where: { id: assessmentId },
      include: {
        employee: {
          select: {
            preferredFirstName: true,
            legalFirstName: true,
            preferredLastName: true,
            legalLastName: true,
          },
        },
        revision: {
          select: {
            revisionLabel: true,
            trainingId: true,
            training: { select: { title: true } },
            sopQuestions: {
              orderBy: { order: "asc" },
              select: { id: true, order: true, questionText: true },
            },
          },
        },
        answers: {
          select: {
            questionId: true,
            answerText: true,
            verdict: true,
            trainerComment: true,
          },
        },
        taskSheetRecord: { select: { dateCompleted: true } },
        practicalRecord: { select: { dateCompleted: true, trainer: true } },
      },
    });
    if (!assessment) throw new Error("ASSESSMENT_NOT_FOUND");
    // A hand-deleted record nulls its link (SetNull) — without both halves this
    // is not a completion and must not be presented as one.
    if (
      assessment.status !== "Passed" ||
      !assessment.taskSheetRecord ||
      !assessment.practicalRecord
    ) {
      throw new Error("NOT_COMPLETED");
    }

    const marker = assessment.markedByUserId
      ? await prisma.user.findUnique({
          where: { id: assessment.markedByUserId },
          select: { name: true },
        })
      : null;

    const answersByQuestion = new Map(
      assessment.answers.map((a) => [a.questionId, a]),
    );
    const employee = assessment.employee;

    return {
      employeeId: assessment.employeeId,
      employeeName: `${employee.preferredFirstName ?? employee.legalFirstName} ${
        employee.preferredLastName ?? employee.legalLastName
      }`,
      sopTitle: assessment.revision.training.title.replace(/ - Task Sheet$/, ""),
      revisionLabel: assessment.revision.revisionLabel,
      acknowledgedOn: assessment.taskSheetRecord.dateCompleted,
      submittedAt: assessment.submittedAt,
      practicalOn: assessment.practicalRecord.dateCompleted,
      trainerName: assessment.practicalRecord.trainer,
      markedAt: assessment.markedAt,
      markedByName: marker?.name ?? null,
      rows: assessment.revision.sopQuestions.map((q) => {
        const answer = answersByQuestion.get(q.id);
        return {
          order: q.order,
          questionText: q.questionText,
          answerText: answer?.answerText ?? "",
          verdict: answer?.verdict ?? null,
          trainerComment: answer?.trainerComment ?? null,
        };
      }),
    };
  }
}

export const sopAssessmentService = new SopAssessmentService();
