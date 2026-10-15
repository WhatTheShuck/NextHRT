import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import prisma from "@/lib/prisma";
import { fileUploadService } from "./fileUploadService";
import { appSettingService } from "./appSettingService";
import { logService } from "./logService";
import { FILE_UPLOAD_CONFIG, estimateEncodedSize } from "@/lib/file-config";
import { AppLogSeverity } from "@/generated/prisma_client/enums";

// Compliance form attachments the Admin can upload/replace (§6.7): the
// employment-forms pack and the police-check form. Each slot stores its
// file(s) under uploads/compliance/ and records them in an AppSetting so the
// rest of the system reads them like any other config value.
//
// The employment-forms slot accepts MULTIPLE files (a pack); police check is a
// single form. To keep storage uniform, every slot stores a JSON array of
// StoredAttachment — police check simply holds at most one. Legacy values
// (a bare relative-path string) are migrated on read.
export type ComplianceAttachmentSlot = "employmentForms" | "policeCheck";

export interface StoredAttachment {
  path: string; // relative path under uploads/
  name: string; // original filename, used as the email attachment name
  size: number; // raw bytes (0 for legacy entries of unknown size)
}

interface SlotConfig {
  settingKey: string;
  multi: boolean;
  label: string;
}

const SLOT_CONFIG: Record<ComplianceAttachmentSlot, SlotConfig> = {
  employmentForms: {
    settingKey: "onboarding.attachment.employmentForms",
    multi: true,
    label: "Employment forms",
  },
  policeCheck: {
    settingKey: "onboarding.attachment.policeCheck",
    multi: false,
    label: "Police check form",
  },
};

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

// Small allowance for the email body/headers on top of attachments when
// checking against the message-size limit.
const EMAIL_BODY_ALLOWANCE = 64 * 1024; // 64KB

/**
 * Parse a stored AppSetting attachment value into a list of attachments.
 * Tolerates the legacy single-path-string format and empty/blank values.
 * Exported so callers reading the raw settings map (e.g. the email fan-out)
 * decode the value the same way the service does.
 */
export function parseStoredAttachments(
  value: string | null | undefined,
): StoredAttachment[] {
  if (!value || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((e) => e && typeof e.path === "string" && e.path)
        .map((e) => ({
          path: e.path as string,
          name:
            typeof e.name === "string" && e.name
              ? e.name
              : path.basename(e.path as string),
          size: typeof e.size === "number" ? e.size : 0,
        }));
    }
  } catch {
    // Not JSON — fall through to legacy single-path handling.
  }
  // Legacy: a bare relative path string.
  return [{ path: value, name: path.basename(value), size: 0 }];
}

const SLOT_ORDER: ComplianceAttachmentSlot[] = ["employmentForms", "policeCheck"];

const resolveUpload = (relativePath: string) =>
  path.join(process.cwd(), "uploads", relativePath);

// The subset of a SEND_EMAIL job payload this service reads/rewrites.
interface QueuedMailPayload {
  to?: string | string[];
  subject?: string;
  attachments?: { filename?: string; path?: string }[];
  complianceSlots?: string[];
  [key: string]: unknown;
}

/** A queued or failed onboarding email whose compliance attachments are gone. */
export interface StaleComplianceEmail {
  jobId: number;
  status: "Pending" | "Failed";
  to: string;
  subject: string;
  createdAt: Date;
  attempts: number;
  slots: ComplianceAttachmentSlot[];
  missingFiles: string[];
}

export interface ResendResult {
  resent: number[];
  skipped: { jobId: number; reason: string }[];
}

export class OnboardingConfigService {
  private getSlotConfig(slot: string): SlotConfig {
    const config = SLOT_CONFIG[slot as ComplianceAttachmentSlot];
    if (!config) {
      throw new Error("INVALID_SLOT");
    }
    return config;
  }

  async getAttachments(slot: string): Promise<StoredAttachment[]> {
    const { settingKey } = this.getSlotConfig(slot);
    const setting = await prisma.appSetting.findUnique({
      where: { key: settingKey },
    });
    return parseStoredAttachments(setting?.value);
  }

  /**
   * Total raw bytes that would be carried by the next compliance email across
   * every slot — employment forms and police check are sent in the same
   * message, so the size limit applies to their combined payload.
   */
  private async totalComplianceBytes(
    override?: { slot: ComplianceAttachmentSlot; attachments: StoredAttachment[] },
  ): Promise<number> {
    let total = 0;
    for (const slot of Object.keys(SLOT_CONFIG) as ComplianceAttachmentSlot[]) {
      const list =
        override && override.slot === slot
          ? override.attachments
          : await this.getAttachments(slot);
      total += list.reduce((sum, a) => sum + a.size, 0);
    }
    return total;
  }

  private assertWithinEmailLimit(rawBytes: number): void {
    const encoded = estimateEncodedSize(rawBytes) + EMAIL_BODY_ALLOWANCE;
    if (encoded > FILE_UPLOAD_CONFIG.MAX_EMAIL_SIZE) {
      throw new Error("EMAIL_SIZE_EXCEEDED");
    }
  }

  /**
   * Add one or more files to a slot. Single-file slots replace their existing
   * file; multi-file slots append. Validates each file (type + per-file size)
   * and the combined compliance-email size before persisting anything.
   */
  async addAttachments(
    slot: string,
    files: File[],
    userId: string,
  ): Promise<StoredAttachment[]> {
    const config = this.getSlotConfig(slot);

    const incoming = files.filter((f) => f instanceof File && f.size > 0);
    if (incoming.length === 0) {
      throw new Error("NO_FILES");
    }

    // Validate type + per-file size up front (throws INVALID_FILE_TYPE / FILE_TOO_LARGE).
    for (const file of incoming) {
      fileUploadService.validateFile(file);
    }

    const existing = config.multi ? await this.getAttachments(slot) : [];
    const projected: StoredAttachment[] = [
      ...existing,
      ...incoming.map((f) => ({ path: "", name: f.name, size: f.size })),
    ];

    // Check the combined email size BEFORE writing any files to disk.
    const projectedTotal = await this.totalComplianceBytes({
      slot: slot as ComplianceAttachmentSlot,
      attachments: projected,
    });
    this.assertWithinEmailLimit(projectedTotal);

    // Single-file slot: clear the previous file(s) before saving the new one.
    if (!config.multi) {
      for (const a of await this.getAttachments(slot)) {
        await fileUploadService.deleteFile(a.path);
      }
    }

    const saved: StoredAttachment[] = config.multi ? [...existing] : [];
    for (const file of incoming) {
      const { imagePath } = await fileUploadService.saveFile(file, "compliance");
      saved.push({ path: imagePath, name: file.name, size: file.size });
    }

    await appSettingService.updateSetting(
      config.settingKey,
      JSON.stringify(saved),
      userId,
    );
    return saved;
  }

  // Read a specific stored file for download. When relativePath is omitted the
  // first file in the slot is returned (used for single-file slots / legacy).
  async readAttachmentFile(
    slot: string,
    relativePath?: string,
  ): Promise<{
    buffer: Buffer;
    contentType: string;
    relativePath: string;
    name: string;
  }> {
    const attachments = await this.getAttachments(slot);
    const target = relativePath
      ? attachments.find((a) => a.path === relativePath)
      : attachments[0];
    if (!target) {
      throw new Error("ATTACHMENT_NOT_FOUND");
    }
    const fullPath = path.join(process.cwd(), "uploads", target.path);
    if (!existsSync(fullPath)) {
      throw new Error("ATTACHMENT_NOT_FOUND");
    }
    const buffer = await readFile(fullPath);
    const contentType =
      CONTENT_TYPE_BY_EXT[path.extname(target.path).toLowerCase()] ??
      "application/octet-stream";
    return { buffer, contentType, relativePath: target.path, name: target.name };
  }

  // Remove a single file from a slot (by its relative path).
  async removeAttachment(
    slot: string,
    relativePath: string,
    userId: string,
  ): Promise<StoredAttachment[]> {
    const config = this.getSlotConfig(slot);
    const attachments = await this.getAttachments(slot);
    const target = attachments.find((a) => a.path === relativePath);
    if (target) {
      await fileUploadService.deleteFile(target.path);
    }
    const remaining = attachments.filter((a) => a.path !== relativePath);
    await appSettingService.updateSetting(
      config.settingKey,
      remaining.length > 0 ? JSON.stringify(remaining) : "",
      userId,
    );
    return remaining;
  }

  /** Stored attachments whose file is no longer on disk, per slot. */
  async getMissingAttachments(): Promise<
    Record<ComplianceAttachmentSlot, StoredAttachment[]>
  > {
    const result = {} as Record<ComplianceAttachmentSlot, StoredAttachment[]>;
    for (const slot of SLOT_ORDER) {
      result[slot] = (await this.getAttachments(slot)).filter(
        (a) => !existsSync(resolveUpload(a.path)),
      );
    }
    return result;
  }

  private isComplianceFile(filePath: string | undefined): boolean {
    if (!filePath) return false;
    const complianceDir = path.join(process.cwd(), "uploads", "compliance");
    return path.resolve(filePath).startsWith(complianceDir + path.sep);
  }

  /**
   * Which slots an email was carrying. Emails queued since complianceSlots was
   * recorded say so directly; older ones are matched by attachment filename
   * against what's uploaded now, falling back to every slot that has files.
   */
  private inferSlots(
    payload: QueuedMailPayload,
    complianceFilenames: string[],
    current: Record<ComplianceAttachmentSlot, StoredAttachment[]>,
  ): ComplianceAttachmentSlot[] {
    if (Array.isArray(payload.complianceSlots)) {
      return SLOT_ORDER.filter((s) => payload.complianceSlots!.includes(s));
    }
    const matched = new Set<ComplianceAttachmentSlot>();
    let unmatched = false;
    for (const name of complianceFilenames) {
      const slot = SLOT_ORDER.find((s) => current[s].some((a) => a.name === name));
      if (slot) matched.add(slot);
      else unmatched = true;
    }
    if (unmatched || matched.size === 0) {
      return SLOT_ORDER.filter((s) => current[s].length > 0);
    }
    return SLOT_ORDER.filter((s) => matched.has(s));
  }

  /**
   * SEND_EMAIL jobs that are still Pending, or have Failed, and attach at least
   * one compliance file that no longer exists on disk. These will fail (or
   * already did) with ENOENT until their attachments are refreshed.
   */
  async findStaleComplianceEmails(): Promise<StaleComplianceEmail[]> {
    const jobs = await prisma.backgroundJob.findMany({
      where: { type: "SEND_EMAIL", status: { in: ["Pending", "Failed"] } },
      orderBy: { createdAt: "desc" },
    });

    const current = {} as Record<ComplianceAttachmentSlot, StoredAttachment[]>;
    for (const slot of SLOT_ORDER) current[slot] = await this.getAttachments(slot);

    const stale: StaleComplianceEmail[] = [];
    for (const job of jobs) {
      let payload: QueuedMailPayload;
      try {
        payload = job.payload ? JSON.parse(job.payload) : {};
      } catch {
        continue;
      }
      const compliance = (payload.attachments ?? []).filter((a) =>
        this.isComplianceFile(a.path),
      );
      const missing = compliance.filter((a) => !existsSync(a.path!));
      if (missing.length === 0) continue;

      stale.push({
        jobId: job.id,
        status: job.status as "Pending" | "Failed",
        to: Array.isArray(payload.to) ? payload.to.join(", ") : payload.to ?? "",
        subject: payload.subject ?? "",
        createdAt: job.createdAt,
        attempts: job.attempts,
        slots: this.inferSlots(
          payload,
          compliance.map((a) => a.filename ?? path.basename(a.path!)),
          current,
        ),
        missingFiles: missing.map((a) => a.filename ?? path.basename(a.path!)),
      });
    }
    return stale;
  }

  /**
   * Swap the compliance attachments on stale emails for the files currently
   * uploaded, then send them again. Failed jobs are requeued with a fresh
   * attempt budget; Pending ones keep their schedule and just get new files.
   * Pass jobIds to limit the resend; omit it to resend every stale email.
   */
  async resendStaleComplianceEmails(
    userId: string,
    jobIds?: number[],
  ): Promise<ResendResult> {
    const stale = (await this.findStaleComplianceEmails()).filter(
      (e) => !jobIds || jobIds.includes(e.jobId),
    );

    const current = {} as Record<ComplianceAttachmentSlot, StoredAttachment[]>;
    for (const slot of SLOT_ORDER) current[slot] = await this.getAttachments(slot);
    const missing = await this.getMissingAttachments();

    const result: ResendResult = { resent: [], skipped: [] };

    for (const email of stale) {
      const unavailable = email.slots.filter(
        (s) => current[s].length === 0 || missing[s].length > 0,
      );
      if (email.slots.length === 0 || unavailable.length > 0) {
        result.skipped.push({
          jobId: email.jobId,
          reason:
            unavailable.length > 0
              ? `Re-upload ${unavailable.map((s) => SLOT_CONFIG[s].label.toLowerCase()).join(" and ")} first`
              : "No compliance files are uploaded",
        });
        continue;
      }

      const job = await prisma.backgroundJob.findUnique({ where: { id: email.jobId } });
      if (!job || job.status !== email.status) {
        result.skipped.push({ jobId: email.jobId, reason: "Job changed state; refresh and try again" });
        continue;
      }
      const payload: QueuedMailPayload = job.payload ? JSON.parse(job.payload) : {};

      const fresh = email.slots.flatMap((s) => current[s]);
      const rawBytes = fresh.reduce((sum, a) => sum + a.size, 0);
      if (estimateEncodedSize(rawBytes) > FILE_UPLOAD_CONFIG.MAX_EMAIL_SIZE) {
        result.skipped.push({
          jobId: email.jobId,
          reason: `Current files exceed the ${FILE_UPLOAD_CONFIG.MAX_EMAIL_SIZE_DISPLAY} email limit`,
        });
        continue;
      }

      const newPayload: QueuedMailPayload = {
        ...payload,
        attachments: [
          ...(payload.attachments ?? []).filter((a) => !this.isComplianceFile(a.path)),
          ...fresh.map((a) => ({ filename: a.name, path: resolveUpload(a.path) })),
        ],
        complianceSlots: email.slots,
      };

      // Guard on the status we read so a job the runner just picked up isn't
      // rewritten mid-send.
      const { count } = await prisma.backgroundJob.updateMany({
        where: { id: job.id, status: job.status },
        data:
          job.status === "Failed"
            ? {
                payload: JSON.stringify(newPayload),
                status: "Pending",
                attempts: 0,
                errorMessage: null,
                resultSummary: null,
                scheduledAt: new Date(),
                startedAt: null,
                completedAt: null,
              }
            : { payload: JSON.stringify(newPayload) },
      });
      if (count === 0) {
        result.skipped.push({ jobId: email.jobId, reason: "Job changed state; refresh and try again" });
        continue;
      }
      result.resent.push(email.jobId);
    }

    if (result.resent.length > 0) {
      await logService.log(
        `Resent ${result.resent.length} onboarding email(s) with current compliance attachments ` +
          `(jobs ${result.resent.join(", ")}) by user ${userId}`,
        AppLogSeverity.Info,
        "onboardingConfig",
      );
    }
    return result;
  }

  // Remove every file in a slot.
  async removeAllAttachments(slot: string, userId: string) {
    const config = this.getSlotConfig(slot);
    for (const a of await this.getAttachments(slot)) {
      await fileUploadService.deleteFile(a.path);
    }
    await appSettingService.updateSetting(config.settingKey, "", userId);
    return { slot };
  }
}

export const onboardingConfigService = new OnboardingConfigService();
