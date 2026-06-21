import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import prisma from "@/lib/prisma";
import { fileUploadService } from "./fileUploadService";
import { appSettingService } from "./appSettingService";

// Compliance form attachments the Admin can upload/replace (§6.7): the
// employment-forms pack and the police-check form. Each slot stores its file
// under uploads/compliance/ and records the relative path in an AppSetting so
// the rest of the system reads it like any other config value.
export type ComplianceAttachmentSlot = "employmentForms" | "policeCheck";

const SLOT_SETTING_KEY: Record<ComplianceAttachmentSlot, string> = {
  employmentForms: "onboarding.attachment.employmentForms",
  policeCheck: "onboarding.attachment.policeCheck",
};

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

export class OnboardingConfigService {
  private assertValidSlot(
    slot: string,
  ): asserts slot is ComplianceAttachmentSlot {
    if (slot !== "employmentForms" && slot !== "policeCheck") {
      throw new Error("INVALID_SLOT");
    }
  }

  async setAttachment(slot: string, file: File, userId: string) {
    this.assertValidSlot(slot);
    const settingKey = SLOT_SETTING_KEY[slot];

    // Remove the previously stored file (if any) before replacing it.
    const existing = await prisma.appSetting.findUnique({
      where: { key: settingKey },
    });
    if (existing?.value) {
      await fileUploadService.deleteFile(existing.value);
    }

    const { imagePath } = await fileUploadService.saveFile(file, "compliance");
    await appSettingService.updateSetting(settingKey, imagePath, userId);
    return { slot, path: imagePath };
  }

  async getAttachmentPath(slot: string): Promise<string | null> {
    this.assertValidSlot(slot);
    const setting = await prisma.appSetting.findUnique({
      where: { key: SLOT_SETTING_KEY[slot] },
    });
    return setting?.value ? setting.value : null;
  }

  async readAttachmentFile(
    slot: string,
  ): Promise<{ buffer: Buffer; contentType: string; relativePath: string }> {
    const relativePath = await this.getAttachmentPath(slot);
    if (!relativePath) {
      throw new Error("ATTACHMENT_NOT_FOUND");
    }
    const fullPath = path.join(process.cwd(), "uploads", relativePath);
    if (!existsSync(fullPath)) {
      throw new Error("ATTACHMENT_NOT_FOUND");
    }
    const buffer = await readFile(fullPath);
    const contentType =
      CONTENT_TYPE_BY_EXT[path.extname(relativePath).toLowerCase()] ??
      "application/octet-stream";
    return { buffer, contentType, relativePath };
  }

  async deleteAttachment(slot: string, userId: string) {
    this.assertValidSlot(slot);
    const settingKey = SLOT_SETTING_KEY[slot];
    const existing = await prisma.appSetting.findUnique({
      where: { key: settingKey },
    });
    if (existing?.value) {
      await fileUploadService.deleteFile(existing.value);
    }
    await appSettingService.updateSetting(settingKey, "", userId);
    return { slot };
  }
}

export const onboardingConfigService = new OnboardingConfigService();
