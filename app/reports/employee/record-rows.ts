import {
  TicketRecordsWithRelations,
  TrainingRecordsWithRelations,
} from "@/lib/types";
import { isRevisionOutOfDate } from "../training/revision-column";

/** One completed training course for the selected employee. */
export interface EmployeeTrainingRow extends Record<string, unknown> {
  id: string;
  title: string;
  category: string;
  dateCompleted: Date;
  trainer: string;
  revisionLabel: string;
  revisionOutOfDate: boolean;
}

/** One ticket held by the selected employee. */
export interface EmployeeTicketRow extends Record<string, unknown> {
  id: string;
  ticketName: string;
  ticketCode: string;
  dateIssued: Date;
  expiryDate: Date | null;
  licenseNumber: string;
  status: TicketStatus;
}

/** A training course and a ticket flattened onto one shared shape. */
export interface EmployeeCombinedRow extends Record<string, unknown> {
  id: string;
  type: "Training" | "Ticket";
  name: string;
  /** Training category, or the ticket code. */
  reference: string;
  /** Date completed for training, date issued for tickets. */
  date: Date;
  expiryDate: Date | null;
  /** Trainer for training, licence number for tickets. */
  detail: string;
  /** Revision state for training, expiry state for tickets. */
  status: string;
  /** Drives the destructive badge on the status column. */
  needsAttention: boolean;
}

export type TicketStatus = "Current" | "Expired" | "No Expiry";

export function ticketStatus(expiryDate: Date | null): TicketStatus {
  if (!expiryDate) return "No Expiry";
  return expiryDate.getTime() < Date.now() ? "Expired" : "Current";
}

export function toTrainingRows(
  records: TrainingRecordsWithRelations[] = [],
): EmployeeTrainingRow[] {
  return records
    .map((record) => ({
      id: `training-${record.id}`,
      title: record.training?.title ?? "Unknown Training",
      category: record.training?.category ?? "",
      dateCompleted: new Date(record.dateCompleted),
      trainer: record.trainer ?? "",
      revisionLabel: record.revision?.revisionLabel ?? "—",
      revisionOutOfDate: isRevisionOutOfDate(record),
    }))
    .sort((a, b) => b.dateCompleted.getTime() - a.dateCompleted.getTime());
}

/**
 * Expired tickets are excluded by default — they no longer say anything about
 * what the employee currently holds. Pass `includeExpired` to keep them.
 */
export function toTicketRows(
  records: TicketRecordsWithRelations[] = [],
  includeExpired: boolean = false,
): EmployeeTicketRow[] {
  return records
    .map((record) => {
      const expiryDate = record.expiryDate ? new Date(record.expiryDate) : null;
      return {
        id: `ticket-${record.id}`,
        ticketName: record.ticket?.ticketName ?? "Unknown Ticket",
        ticketCode: record.ticket?.ticketCode ?? "",
        dateIssued: new Date(record.dateIssued),
        expiryDate,
        licenseNumber: record.licenseNumber ?? "",
        status: ticketStatus(expiryDate),
      };
    })
    .filter((row) => includeExpired || row.status !== "Expired")
    .sort((a, b) => b.dateIssued.getTime() - a.dateIssued.getTime());
}

export function toCombinedRows(
  trainingRecords: TrainingRecordsWithRelations[] = [],
  ticketRecords: TicketRecordsWithRelations[] = [],
  includeExpired: boolean = false,
): EmployeeCombinedRow[] {
  const training: EmployeeCombinedRow[] = toTrainingRows(trainingRecords).map(
    (row) => ({
      id: row.id,
      type: "Training",
      name: row.title,
      reference: row.category,
      date: row.dateCompleted,
      expiryDate: null,
      detail: row.trainer,
      status: row.revisionOutOfDate ? "Update Needed" : row.revisionLabel,
      needsAttention: row.revisionOutOfDate,
    }),
  );

  const tickets: EmployeeCombinedRow[] = toTicketRows(
    ticketRecords,
    includeExpired,
  ).map((row) => ({
    id: row.id,
    type: "Ticket",
    name: row.ticketName,
    reference: row.ticketCode,
    date: row.dateIssued,
    expiryDate: row.expiryDate,
    detail: row.licenseNumber,
    status: row.status,
    needsAttention: row.status === "Expired",
  }));

  return [...training, ...tickets].sort(
    (a, b) => b.date.getTime() - a.date.getTime(),
  );
}
