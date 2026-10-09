import prisma from "@/lib/prisma";
import type { DocumentSubmissionStatus, Prisma } from "@/generated/prisma_client/client";
import { appSettingService } from "./appSettingService";
import { getEmployeeIdsInScope, scopeWhere } from "./employeeScopeService";
import { findMissingItems, type MissingReason } from "./missingItems";
import { employeeDisplayName } from "./employeeAddress";
import { DAY_MS, DEFAULT_EMPLOYEE_MILESTONES, parseMilestones, pickCurrentRecords } from "./ticketExpiryShared";
import type { Actor } from "./documentSubmissionService";

/** Data for the viewer-scoped Expiring & Missing page (spec "Expiring & Missing" page). */

export interface OpenChip {
  id: number;
  status: DocumentSubmissionStatus;
  /** Only the submitter can fix a sent-back upload. */
  isMine: boolean;
}
interface PersonCols {
  employeeId: number;
  employeeName: string;
  departmentName: string;
}
export interface ExpiryRow extends PersonCols {
  kind: "Ticket";
  itemId: number;
  itemName: string;
  recordId: number;
  expiryDate: string;
  days: number; // ≤ 0 once expired
  open: OpenChip | null;
}
export interface MissingRow extends PersonCols {
  kind: "Ticket" | "Training";
  itemId: number;
  itemName: string;
  reason: MissingReason;
  open: OpenChip | null;
}
export interface SubmissionRow extends PersonCols {
  id: number;
  kind: "Ticket" | "Training";
  itemId: number;
  itemName: string;
  status: DocumentSubmissionStatus;
  createdAt: string;
  reviewComment: string | null;
  submittedByName: string | null;
  isMine: boolean;
}
export interface ExpiringStatus {
  expiring: ExpiryRow[];
  expired: ExpiryRow[];
  missing: MissingRow[];
  submitted: SubmissionRow[];
  reviewQueue: SubmissionRow[] | null;
  /** How far ahead "Expiring" looks: the furthest employee reminder milestone, in days. */
  windowDays: number;
}

const OPEN: DocumentSubmissionStatus[] = ["Pending", "ChangesRequested"];
const RECENT_APPROVED_DAYS = 30;
const URGENT_DAYS = 30;
const chipKey = (employeeId: number, kind: string, itemId: number) => `${employeeId}:${kind}:${itemId}`;

export class DocumentStatusService {
  async getStatus(
    actor: Actor,
    filters: { departmentId?: number; employeeId?: number } = {},
    now = new Date(),
  ): Promise<ExpiringStatus> {
    const scope = await getEmployeeIdsInScope(actor.userId, actor.role, { level: "View" });
    // The page's employee/department filters alone. They also narrow the viewer's own
    // submissions, which bypass scope and isActive.
    const filterWhere: Prisma.EmployeeWhereInput = {
      ...(filters.employeeId ? { id: filters.employeeId } : {}),
      ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
    };
    const employeeWhere: Prisma.EmployeeWhereInput = {
      isActive: true,
      AND: [scopeWhere(scope), filterWhere],
    };
    const settings = await appSettingService.getSettings();
    const windowDays = parseMilestones(settings["tickets.expiryReminderDays"], DEFAULT_EMPLOYEE_MILESTONES)[0];

    const [employees, records, missingItems, submissions] = await Promise.all([
      prisma.employee.findMany({
        where: employeeWhere,
        select: {
          id: true, legalFirstName: true, legalLastName: true, preferredFirstName: true, preferredLastName: true,
          department: { select: { name: true } },
        },
      }),
      prisma.ticketRecords.findMany({
        where: { ticketHolder: employeeWhere, ticket: { isActive: true } },
        select: { id: true, employeeId: true, ticketId: true, dateIssued: true, expiryDate: true, ticket: { select: { ticketName: true } } },
      }),
      findMissingItems(employeeWhere),
      prisma.documentSubmission.findMany({
        where: {
          AND: [
            { OR: [{ employee: employeeWhere }, { submittedByUserId: actor.userId, employee: filterWhere }] },
            {
              OR: [
                { status: { in: OPEN } },
                { status: "Approved", reviewedAt: { gte: new Date(now.getTime() - RECENT_APPROVED_DAYS * DAY_MS) } },
              ],
            },
          ],
        },
        include: {
          employee: {
            select: {
              id: true, legalFirstName: true, legalLastName: true, preferredFirstName: true, preferredLastName: true,
              department: { select: { name: true } },
            },
          },
          ticket: { select: { ticketName: true } },
          training: { select: { title: true } },
          submittedByUser: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const person = new Map<number, PersonCols>(
      employees.map((e) => [e.id, { employeeId: e.id, employeeName: employeeDisplayName(e), departmentName: e.department.name }]),
    );
    const openByItem = new Map<string, OpenChip>();
    for (const s of submissions) {
      if (OPEN.includes(s.status)) {
        openByItem.set(chipKey(s.employeeId, s.kind, (s.ticketId ?? s.trainingId)!), {
          id: s.id, status: s.status, isMine: s.submittedByUserId === actor.userId,
        });
      }
    }

    const expiring: ExpiryRow[] = [];
    const expired: ExpiryRow[] = [];
    for (const r of pickCurrentRecords(records)) {
      const who = person.get(r.employeeId);
      if (!who || !r.expiryDate) continue;
      const days = Math.ceil((r.expiryDate.getTime() - now.getTime()) / DAY_MS);
      const row: ExpiryRow = {
        ...who, kind: "Ticket", itemId: r.ticketId, itemName: r.ticket.ticketName, recordId: r.id,
        expiryDate: r.expiryDate.toISOString(), days, open: openByItem.get(chipKey(r.employeeId, "Ticket", r.ticketId)) ?? null,
      };
      if (r.expiryDate.getTime() <= now.getTime()) expired.push(row);
      else if (days <= windowDays) expiring.push(row);
    }
    expiring.sort((a, b) => a.days - b.days);
    expired.sort((a, b) => b.days - a.days); // most recently expired first

    const missing: MissingRow[] = missingItems.flatMap((m) => {
      const who = person.get(m.employeeId);
      return who ? [{ ...who, ...m, open: openByItem.get(chipKey(m.employeeId, m.kind, m.itemId)) ?? null }] : [];
    });

    const toRow = (s: (typeof submissions)[number]): SubmissionRow => ({
      employeeId: s.employeeId,
      employeeName: employeeDisplayName(s.employee),
      departmentName: s.employee.department.name,
      id: s.id,
      kind: s.kind,
      itemId: (s.ticketId ?? s.trainingId)!,
      itemName: s.ticket?.ticketName ?? s.training?.title ?? "",
      status: s.status,
      createdAt: s.createdAt.toISOString(),
      reviewComment: s.reviewComment,
      submittedByName: s.submittedByUser?.name ?? null,
      isMine: s.submittedByUserId === actor.userId,
    });

    return {
      expiring,
      expired,
      missing,
      submitted: submissions.map(toRow).reverse(), // newest first
      reviewQueue: actor.role === "Admin" ? submissions.filter((s) => s.status === "Pending").map(toRow) : null,
      windowDays,
    };
  }

  /** Nav-card badge (spec "Badge"). */
  async count(actor: Actor, now = new Date()): Promise<number> {
    const s = await this.getStatus(actor, {}, now);
    const urgent = s.expiring.filter((r) => r.days <= URGENT_DAYS).length;
    if (actor.role === "Admin") return (s.reviewQueue?.length ?? 0) + urgent;
    return s.expired.length + s.missing.length + urgent;
  }
}

export const documentStatusService = new DocumentStatusService();
