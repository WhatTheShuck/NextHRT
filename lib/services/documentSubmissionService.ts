import prisma from "@/lib/prisma";
import type { DocumentSubmissionStatus, Prisma } from "@/generated/prisma_client/client";
import { FILE_UPLOAD_CONFIG } from "@/lib/file-config";
import { matchesDeclaredType, sniffFileType, type SniffedType } from "@/lib/file-signature";
import { enqueue } from "@/lib/jobs/jobQueue";
import { appLink } from "@/lib/appUrl";
import { escapeHtml } from "@/lib/email-templates/tokens";
import { fileUploadService, SUBMISSIONS_DIR } from "./fileUploadService";
import { canActForEmployee, getEmployeeIdsInScope, scopeWhere } from "./employeeScopeService";
import { resolveTicketExpiry } from "./ticketExpiryDate";
import { currentRevision } from "./trainingCompliance";
import { emailTemplateService } from "./emailTemplateService";
import { EMPLOYEE_ADDRESS_SELECT, employeeAddress, employeeDisplayName } from "./employeeAddress";

/**
 * Employee/manager document uploads, held until an admin approves them
 * (docs/superpowers/specs/2026-10-09-document-upload-design.md). Nothing here writes a
 * TicketRecords/TrainingRecords row except `approve`.
 */

type Db = Prisma.TransactionClient | typeof prisma;

export interface Actor {
  userId: string;
  role: string;
}

export interface SubmissionFields {
  employeeId: number;
  kind: "Ticket" | "Training";
  itemId: number;
  dateIssued: Date;
  expiryDate: Date | null;
  licenseNumber: string | null;
  provider: string | null;
}

export type ReviewEdits = Partial<Pick<SubmissionFields, "itemId" | "dateIssued" | "expiryDate" | "licenseNumber" | "provider">>;

export const MAX_FILES = 6;
export const MAX_REQUEST_BYTES = 30 * 1024 * 1024;
export const OPEN_STATUSES: DocumentSubmissionStatus[] = ["Pending", "ChangesRequested"];

const itemWhere = (kind: SubmissionFields["kind"], itemId: number) =>
  kind === "Ticket" ? { ticketId: itemId } : { trainingId: itemId };

function itemIdOf(s: { kind: SubmissionFields["kind"]; ticketId: number | null; trainingId: number | null }): number {
  const id = s.kind === "Ticket" ? s.ticketId : s.trainingId;
  if (id === null) throw new Error("NOT_FOUND");
  return id;
}

function toColumns(f: SubmissionFields) {
  return {
    employeeId: f.employeeId,
    kind: f.kind,
    ticketId: f.kind === "Ticket" ? f.itemId : null,
    trainingId: f.kind === "Training" ? f.itemId : null,
    dateIssued: f.dateIssued,
    expiryDate: f.expiryDate,
    licenseNumber: f.licenseNumber,
    provider: f.provider,
  };
}

const EXTENSION: Record<SniffedType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/**
 * Checks count, size and real type, and returns the files renamed to the extension of what they
 * actually are. fileUploadService stores the extension from the name and imageService serves the
 * Content-Type from it, so a PDF named "x.jpg" must not stay "x.jpg".
 */
async function validateFiles(files: File[], keptCount = 0): Promise<File[]> {
  const total = files.length + keptCount;
  if (total < 1) throw new Error("NO_FILES");
  if (total > MAX_FILES) throw new Error("TOO_MANY_FILES");
  if (files.reduce((n, f) => n + f.size, 0) > MAX_REQUEST_BYTES) throw new Error("REQUEST_TOO_LARGE");
  const out: File[] = [];
  for (const f of files) {
    if (f.size > FILE_UPLOAD_CONFIG.MAX_FILE_SIZE) throw new Error("FILE_TOO_LARGE");
    const sniffed = sniffFileType(new Uint8Array(await f.slice(0, 16).arrayBuffer()));
    if (!sniffed || !matchesDeclaredType(f.type, sniffed)) throw new Error("INVALID_FILE_TYPE");
    const base = f.name.replace(/\.[^.]*$/, "") || "upload";
    out.push(new File([f], `${base}.${EXTENSION[sniffed]}`, { type: sniffed }));
  }
  return out;
}

/** The same rules manual entry enforces, so a bad upload fails at submit, not at review. */
async function validateFields(f: SubmissionFields, db: Db): Promise<SubmissionFields> {
  const employee = await db.employee.findUnique({ where: { id: f.employeeId }, select: { isActive: true } });
  if (!employee) throw new Error("EMPLOYEE_NOT_FOUND");
  if (!employee.isActive) throw new Error("EMPLOYEE_INACTIVE");

  if (f.kind === "Ticket") {
    const ticket = await db.ticket.findUnique({ where: { id: f.itemId }, select: { isActive: true, renewal: true } });
    if (!ticket || !ticket.isActive) throw new Error("ITEM_NOT_AVAILABLE");
    const expiryDate = resolveTicketExpiry(f.dateIssued, ticket.renewal, f.expiryDate);
    const dup = await db.ticketRecords.findFirst({
      where: { employeeId: f.employeeId, ticketId: f.itemId, dateIssued: f.dateIssued },
      select: { id: true },
    });
    if (dup) throw new Error("DUPLICATE_RECORD");
    return { ...f, expiryDate, licenseNumber: f.licenseNumber?.trim() || null, provider: null };
  }

  const training = await db.training.findUnique({
    where: { id: f.itemId },
    select: { isActive: true, category: true },
  });
  if (!training || !training.isActive || training.category !== "External") throw new Error("ITEM_NOT_AVAILABLE");
  const provider = f.provider?.trim();
  if (!provider) throw new Error("PROVIDER_REQUIRED");
  const dup = await db.trainingRecords.findFirst({
    where: { employeeId: f.employeeId, trainingId: f.itemId, dateCompleted: f.dateIssued },
    select: { id: true },
  });
  if (dup) throw new Error("DUPLICATE_RECORD");
  return { ...f, expiryDate: null, licenseNumber: null, provider };
}

/** At most one open submission per employee + item: a newer one replaces the rest. */
async function cancelOtherOpen(db: Db, f: Pick<SubmissionFields, "employeeId" | "kind" | "itemId">, exceptId?: number) {
  await db.documentSubmission.updateMany({
    where: {
      employeeId: f.employeeId,
      ...itemWhere(f.kind, f.itemId),
      status: { in: OPEN_STATUSES },
      ...(exceptId !== undefined ? { id: { not: exceptId } } : {}),
    },
    data: { status: "Cancelled" },
  });
}

const fileRows = (saved: { imagePath: string; imageType: string; originalName: string }[]) =>
  saved.map((s) => ({ filePath: s.imagePath, fileType: s.imageType, originalName: s.originalName }));

async function history(db: Db, tableName: string, recordId: number, action: string, values: unknown, userId: string) {
  await db.history.create({
    data: { tableName, recordId: String(recordId), action, newValues: JSON.stringify(values), userId },
  });
}

const DETAIL_INCLUDE = {
  files: { orderBy: { id: "asc" } },
  employee: { select: { ...EMPLOYEE_ADDRESS_SELECT, department: { select: { name: true } } } },
  submittedByUser: { select: { id: true, name: true, email: true, employeeId: true } },
  reviewedByUser: { select: { name: true } },
  ticket: { select: { ticketName: true, renewal: true } },
  training: { select: { title: true } },
} satisfies Prisma.DocumentSubmissionInclude;

export class DocumentSubmissionService {
  async submit(fields: SubmissionFields, files: File[], actor: Actor) {
    if (!(await canActForEmployee(actor.userId, actor.role, fields.employeeId))) throw new Error("NOT_AUTHORISED");
    const valid = await validateFields(fields, prisma);
    const checked = await validateFiles(files);
    // Saved before the transaction; if it then fails, the cleanup job removes the unreferenced files.
    const saved = await fileUploadService.saveFiles(checked, SUBMISSIONS_DIR);

    return prisma.$transaction(async (tx) => {
      await cancelOtherOpen(tx, valid);
      const created = await tx.documentSubmission.create({
        data: { ...toColumns(valid), submittedByUserId: actor.userId, files: { create: fileRows(saved) } },
      });
      await history(tx, "DocumentSubmission", created.id, "CREATE", created, actor.userId);
      return created;
    });
  }

  async resubmit(id: number, fields: SubmissionFields, newFiles: File[], removedFileIds: number[], actor: Actor) {
    const sub = await prisma.documentSubmission.findUnique({ where: { id }, include: { files: true } });
    if (!sub) throw new Error("NOT_FOUND");
    if (sub.submittedByUserId !== actor.userId) throw new Error("NOT_AUTHORISED");
    if (sub.status !== "ChangesRequested") throw new Error("NOT_EDITABLE");
    if (fields.employeeId !== sub.employeeId || fields.kind !== sub.kind) throw new Error("INVALID_CHANGE");
    // Scope can change between submit and resubmit (a manager moves teams).
    if (!(await canActForEmployee(actor.userId, actor.role, sub.employeeId))) throw new Error("NOT_AUTHORISED");

    const valid = await validateFields(fields, prisma);
    const kept = sub.files.filter((f) => !removedFileIds.includes(f.id));
    const checked = await validateFiles(newFiles, kept.length);
    const saved = checked.length > 0 ? await fileUploadService.saveFiles(checked, SUBMISSIONS_DIR) : [];

    return prisma.$transaction(async (tx) => {
      if (valid.itemId !== itemIdOf(sub)) await cancelOtherOpen(tx, valid, id);
      if (removedFileIds.length > 0) {
        await tx.documentSubmissionFile.deleteMany({ where: { submissionId: id, id: { in: removedFileIds } } });
      }
      if (saved.length > 0) {
        await tx.documentSubmissionFile.createMany({ data: fileRows(saved).map((r) => ({ ...r, submissionId: id })) });
      }
      // Claim the transition atomically: only a still-sent-back submission moves to Pending.
      const { count } = await tx.documentSubmission.updateMany({
        where: { id, status: "ChangesRequested" },
        data: { ...toColumns(valid), status: "Pending" },
      });
      if (count === 0) throw new Error("NOT_EDITABLE");
      const updated = await tx.documentSubmission.findUnique({ where: { id } });
      if (!updated) throw new Error("NOT_FOUND");
      await history(tx, "DocumentSubmission", id, "UPDATE", { resubmitted: true, ...updated }, actor.userId);
      return updated;
    });
  }

  async cancel(id: number, actor: Actor) {
    const sub = await prisma.documentSubmission.findUnique({ where: { id } });
    if (!sub) throw new Error("NOT_FOUND");
    if (sub.submittedByUserId !== actor.userId && actor.role !== "Admin") throw new Error("NOT_AUTHORISED");
    if (!OPEN_STATUSES.includes(sub.status)) throw new Error("NOT_EDITABLE");
    await prisma.$transaction(async (tx) => {
      const { count } = await tx.documentSubmission.updateMany({
        where: { id, status: { in: OPEN_STATUSES } },
        data: { status: "Cancelled" },
      });
      if (count === 0) throw new Error("NOT_EDITABLE");
      await history(tx, "DocumentSubmission", id, "UPDATE", { id, status: "Cancelled" }, actor.userId);
    });
    return { ...sub, status: "Cancelled" as const };
  }

  /** Called from both deactivation paths (employeeService.updateEmployee, INACTIVE_EMPLOYEE_CHECK). */
  async cancelOpenForEmployees(employeeIds: number[], db: Db = prisma) {
    if (employeeIds.length === 0) return { count: 0 };
    return db.documentSubmission.updateMany({
      where: { employeeId: { in: employeeIds }, status: { in: OPEN_STATUSES } },
      data: { status: "Cancelled" },
    });
  }

  /** Submitter, anyone with View scope over the employee, or an admin. */
  async get(id: number, actor: Actor) {
    const sub = await prisma.documentSubmission.findUnique({ where: { id }, include: DETAIL_INCLUDE });
    if (!sub) throw new Error("NOT_FOUND");
    if (sub.submittedByUserId !== actor.userId) {
      const scope = await getEmployeeIdsInScope(actor.userId, actor.role, { level: "View" });
      if (scope !== "all" && !scope.includes(sub.employeeId)) throw new Error("NOT_AUTHORISED");
    }
    return sub;
  }

  async list(filters: { status?: DocumentSubmissionStatus[]; employeeId?: number }, actor: Actor) {
    const scope = await getEmployeeIdsInScope(actor.userId, actor.role, { level: "View" });
    return prisma.documentSubmission.findMany({
      where: {
        OR: [{ employee: scopeWhere(scope) }, { submittedByUserId: actor.userId }],
        ...(filters.status ? { status: { in: filters.status } } : {}),
        ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
      },
      include: DETAIL_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  }

  async approve(id: number, edits: ReviewEdits, actor: Actor) {
    if (actor.role !== "Admin") throw new Error("NOT_AUTHORISED");

    const { submission, recordId } = await prisma.$transaction(async (tx) => {
      const sub = await tx.documentSubmission.findUnique({ where: { id }, include: { files: true } });
      if (!sub) throw new Error("NOT_FOUND");
      if (sub.status !== "Pending") throw new Error("NOT_PENDING");

      const merged: SubmissionFields = {
        employeeId: sub.employeeId,
        kind: sub.kind,
        itemId: edits.itemId ?? itemIdOf(sub),
        dateIssued: edits.dateIssued ?? sub.dateIssued,
        expiryDate: edits.expiryDate !== undefined ? edits.expiryDate : sub.expiryDate,
        licenseNumber: edits.licenseNumber !== undefined ? edits.licenseNumber : sub.licenseNumber,
        provider: edits.provider !== undefined ? edits.provider : sub.provider,
      };
      const valid = await validateFields(merged, tx);
      if (valid.itemId !== itemIdOf(sub)) await cancelOtherOpen(tx, valid, id);

      // The record's images share the submission's files (spec decision 13): nothing is moved.
      const images = { create: sub.files.map((f) => ({ imagePath: f.filePath, imageType: f.fileType, originalName: f.originalName })) };
      let record: { id: number };
      if (valid.kind === "Ticket") {
        record = await tx.ticketRecords.create({
          data: {
            employeeId: valid.employeeId, ticketId: valid.itemId, dateIssued: valid.dateIssued,
            expiryDate: valid.expiryDate, licenseNumber: valid.licenseNumber, images,
          },
        });
      } else {
        const training = await tx.training.findUnique({
          where: { id: valid.itemId },
          select: { revisions: { select: { id: true, effectiveDate: true, createdAt: true, overrideRequiresRetraining: true } } },
        });
        record = await tx.trainingRecords.create({
          data: {
            employeeId: valid.employeeId, trainingId: valid.itemId, dateCompleted: valid.dateIssued,
            trainer: valid.provider!, revisionId: currentRevision(training?.revisions ?? [], valid.dateIssued)?.id ?? null,
            images,
          },
        });
      }

      // Claim the transition atomically: a second reviewer racing this one gets NOT_PENDING.
      const { count } = await tx.documentSubmission.updateMany({
        where: { id, status: "Pending" },
        data: {
          ...toColumns(valid), status: "Approved", resultRecordId: record.id,
          reviewedByUserId: actor.userId, reviewedAt: new Date(),
        },
      });
      if (count === 0) throw new Error("NOT_PENDING");
      const updated = await tx.documentSubmission.findUnique({ where: { id } });
      if (!updated) throw new Error("NOT_FOUND");
      await history(tx, valid.kind === "Ticket" ? "TicketRecords" : "TrainingRecords", record.id, "CREATE",
        { ...record, _metadata: { fromDocumentSubmissionId: id } }, actor.userId);
      await history(tx, "DocumentSubmission", id, "UPDATE", updated, actor.userId);
      await tx.missingDocumentReminder.deleteMany({
        where: { employeeId: valid.employeeId, itemType: valid.kind, itemId: valid.itemId },
      });
      return { submission: updated, recordId: record.id };
    }).catch((e: unknown) => {
      // Two approvals racing past the findFirst check. TrainingRecords' unique index is the
      // backstop (TicketRecords has none; its duplicate check is findFirst only, as in manual entry).
      if ((e as { code?: string }).code === "P2002") throw new Error("DUPLICATE_RECORD");
      throw e;
    });

    // Best-effort: the approval has committed, so nothing after this may surface as an error.
    try {
      await enqueue("REQUIREMENTS_CACHE_INVALIDATE", { employeeId: submission.employeeId });
    } catch (err) {
      console.error(`[documentSubmission] cache invalidate enqueue failed for submission ${id}:`, err);
    }
    try {
      await this.notify(id, "document.approved");
    } catch (err) {
      console.error(`[documentSubmission] approved notification failed for submission ${id}:`, err);
    }
    return { submission, recordId };
  }

  async sendBack(id: number, reason: string, actor: Actor) {
    if (actor.role !== "Admin") throw new Error("NOT_AUTHORISED");
    const trimmed = reason.trim();
    if (!trimmed) throw new Error("REASON_REQUIRED");

    const sub = await prisma.documentSubmission.findUnique({ where: { id } });
    if (!sub) throw new Error("NOT_FOUND");
    if (sub.status !== "Pending") throw new Error("NOT_PENDING");

    const data = { status: "ChangesRequested" as const, reviewComment: trimmed, reviewedByUserId: actor.userId, reviewedAt: new Date() };
    const updated = { ...sub, ...data };
    await prisma.$transaction(async (tx) => {
      const { count } = await tx.documentSubmission.updateMany({ where: { id, status: "Pending" }, data });
      if (count === 0) throw new Error("NOT_PENDING");
      await history(tx, "DocumentSubmission", id, "UPDATE", updated, actor.userId);
    });
    // Best-effort: the send-back has committed.
    try {
      await this.notify(id, "document.changesRequested");
    } catch (err) {
      console.error(`[documentSubmission] changesRequested notification failed for submission ${id}:`, err);
    }
    return updated;
  }

  /** Approved → submitter + the employee (if someone else submitted). Sent back → submitter. */
  private async notify(id: number, templateKey: "document.approved" | "document.changesRequested") {
    const sub = await prisma.documentSubmission.findUnique({ where: { id }, include: DETAIL_INCLUDE });
    if (!sub) return;

    const to = new Set<string>();
    if (sub.submittedByUser?.email) to.add(sub.submittedByUser.email);
    if (templateKey === "document.approved" && sub.submittedByUser?.employeeId !== sub.employee.id) {
      to.add(employeeAddress(sub.employee));
    }
    if (to.size === 0) return;

    const rendered = await emailTemplateService.render(templateKey, {
      employeeName: escapeHtml(employeeDisplayName(sub.employee)),
      itemName: escapeHtml(sub.ticket?.ticketName ?? sub.training?.title ?? "document"),
      ...(templateKey === "document.changesRequested" ? { reason: escapeHtml(sub.reviewComment ?? "") } : {}),
      submissionUrl: appLink(
        templateKey === "document.approved" ? "/expiring?tab=submitted" : `/forms/document-upload?submission=${id}`,
      ),
    });
    if (!rendered) return;
    await enqueue("SEND_EMAIL", { to: [...to], subject: rendered.subject, html: rendered.body });
  }
}

export const documentSubmissionService = new DocumentSubmissionService();
