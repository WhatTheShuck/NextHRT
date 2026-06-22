import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import prisma from "@/lib/prisma";
import { fileUploadService } from "./fileUploadService";
import { appSettingService } from "./appSettingService";
import { FILE_UPLOAD_CONFIG, estimateEncodedSize } from "@/lib/file-config";

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
