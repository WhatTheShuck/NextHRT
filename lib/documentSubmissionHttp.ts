import { NextResponse } from "next/server";
import { z } from "zod";
import { FILE_UPLOAD_CONFIG } from "@/lib/file-config";
import { MAX_FILES, MAX_REQUEST_BYTES } from "@/lib/services/documentSubmissionService";

// Request parsing and error mapping shared by the /api/document-submissions routes.

const isoDate = z.string().min(1).transform((v) => new Date(v)).refine((d) => !Number.isNaN(d.getTime()), "Invalid date");
const optionalIsoDate = z
  .string()
  .optional()
  .transform((v) => (v ? new Date(v) : null))
  .refine((d) => d === null || !Number.isNaN(d.getTime()), "Invalid date");
const optionalText = z.string().optional().transform((v) => v?.trim() || null);

export const fieldsSchema = z.object({
  employeeId: z.coerce.number().int().positive(),
  kind: z.enum(["Ticket", "Training"]),
  itemId: z.coerce.number().int().positive(),
  dateIssued: isoDate,
  expiryDate: optionalIsoDate,
  licenseNumber: optionalText,
  provider: optionalText,
});

const FIELD_KEYS = ["employeeId", "kind", "itemId", "dateIssued", "expiryDate", "licenseNumber", "provider"] as const;

export function fieldsFromForm(fd: FormData) {
  const raw: Record<string, string | undefined> = {};
  for (const k of FIELD_KEYS) {
    const v = fd.get(k);
    raw[k] = typeof v === "string" ? v : undefined;
  }
  return fieldsSchema.safeParse(raw);
}

export function filesFromForm(fd: FormData): File[] {
  return fd.getAll("files").filter((f): f is File => typeof f !== "string" && f.size > 0);
}

export const editsSchema = z
  .object({
    itemId: z.number().int().positive(),
    dateIssued: isoDate,
    expiryDate: z.union([isoDate, z.null()]),
    licenseNumber: z.union([z.string().transform((v) => v.trim() || null), z.null()]),
    provider: z.union([z.string().transform((v) => v.trim() || null), z.null()]),
  })
  .partial();

/** A route `[id]` segment as a positive integer, or null when it isn't one. */
export function parseId(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/** Reads a JSON body. Only an empty body counts as `{}`; anything unparseable is refused. */
export async function parseJsonBody(request: Request): Promise<{ ok: true; value: unknown } | { ok: false }> {
  const text = await request.text();
  if (!text.trim()) return { ok: true, value: {} };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

export const sendBackSchema = z.object({ reason: z.string().min(1) });

const ERRORS: Record<string, [number, string]> = {
  NOT_AUTHORISED: [403, "You can't do that for this employee."],
  NOT_FOUND: [404, "Submission not found."],
  EMPLOYEE_NOT_FOUND: [404, "Employee not found."],
  EMPLOYEE_INACTIVE: [422, "This employee is no longer active."],
  ITEM_NOT_AVAILABLE: [422, "That ticket or training can't be uploaded here."],
  INVALID_EXPIRY_DATE: [422, "The expiry date must be after the issue date."],
  EXPIRY_DATE_REQUIRED: [422, "This ticket needs an expiry date."],
  PROVIDER_REQUIRED: [422, "Enter who delivered the training."],
  DUPLICATE_RECORD: [409, "HRT already has a record for this item on that date."],
  NO_FILES: [422, "Attach at least one photo or file."],
  TOO_MANY_FILES: [422, `Attach no more than ${MAX_FILES} files.`],
  REQUEST_TOO_LARGE: [413, "The files are too large together. Remove some and try again."],
  FILE_TOO_LARGE: [413, `Each file must be ${FILE_UPLOAD_CONFIG.MAX_FILE_SIZE_DISPLAY} or smaller.`],
  INVALID_FILE_TYPE: [415, `Only ${FILE_UPLOAD_CONFIG.ALLOWED_TYPES_DISPLAY} files can be uploaded.`],
  NOT_EDITABLE: [409, "This submission can't be changed any more."],
  NOT_PENDING: [409, "This submission has already been reviewed."],
  INVALID_CHANGE: [422, "The employee and type of a submission can't be changed."],
  REASON_REQUIRED: [422, "Give a reason for sending it back."],
};

export function errorResponse(error: unknown): NextResponse {
  const code = error instanceof Error ? error.message : "";
  const known = ERRORS[code];
  if (known) return NextResponse.json({ code, message: known[1] }, { status: known[0] });
  console.error("document-submissions:", error);
  return NextResponse.json({ code: "INTERNAL", message: "Something went wrong." }, { status: 500 });
}

export const badRequest = (issues: unknown) =>
  NextResponse.json({ code: "INVALID_INPUT", message: "Check the form and try again.", issues }, { status: 400 });

/**
 * Reads a multipart body, refusing an oversized one from its Content-Length before buffering it
 * (the service re-checks the real total). Returns a response on failure.
 */
export async function readForm(request: Request): Promise<FormData | NextResponse> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_REQUEST_BYTES + 1024 * 1024) return errorResponse(new Error("REQUEST_TOO_LARGE"));
  try {
    return await request.formData();
  } catch {
    return badRequest("Expected a multipart form upload");
  }
}

export const actorOf = (session: { user: { id: string; role?: string | null } }) => ({
  userId: session.user.id,
  role: session.user.role ?? "User",
});
