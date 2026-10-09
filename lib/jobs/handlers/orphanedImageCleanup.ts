import prisma from "@/lib/prisma";
import fs from "fs";
import path from "path";
import { parseStoredAttachments } from "@/lib/services/onboardingConfigService";

// Only these uploads/ subfolders are scanned for unreferenced files — each one
// has its references gathered below. Anything else under uploads/ (a folder a
// future feature adds) is left alone rather than wiped for being "unknown".
const MANAGED_DIRS = ["training", "tickets", "sop-documents", "compliance", "submissions"];

// Compliance attachments (employment forms / police check) are referenced from
// AppSetting rows, not a table of their own.
const COMPLIANCE_SETTING_KEYS = [
  "onboarding.attachment.employmentForms",
  "onboarding.attachment.policeCheck",
];

// Stored paths are relative to uploads/ (e.g. "training/<uuid>.jpg" — that is
// what fileUploadService returns). The defensive replace also keeps any legacy
// rows that stored an "uploads/" prefix resolving to the same on-disk file.
const resolveUpload = (p: string) =>
  path.resolve(process.cwd(), "uploads", p.replace(/^uploads\//, ""));

export async function orphanedImageCleanupHandler(
  _payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  let orphanedDbRecords = 0;
  let orphanedFiles = 0;

  const [trainingImages, ticketImages, trainingRevisionDocs, complianceSettings, submissionFiles] =
    await Promise.all([
      prisma.trainingImage.findMany({ select: { id: true, imagePath: true } }),
      prisma.ticketImage.findMany({ select: { id: true, imagePath: true } }),
      prisma.trainingRevision.findMany({
        where: { documentPath: { not: null } },
        select: { documentPath: true },
      }),
      prisma.appSetting.findMany({
        where: { key: { in: COMPLIANCE_SETTING_KEYS } },
        select: { value: true },
      }),
      // Cancelled submissions' files are garbage unless an approved record still points at them
      // (it can't: only Approved submissions become records). Approved ones are also covered by
      // the ticket/training image rows below.
      prisma.documentSubmissionFile.findMany({
        where: { submission: { status: { not: "Cancelled" } } },
        select: { filePath: true },
      }),
    ]);

  // DB records whose file is missing on disk
  const missingTrainingImageIds: number[] = [];
  for (const img of trainingImages) {
    if (!fs.existsSync(resolveUpload(img.imagePath))) {
      missingTrainingImageIds.push(img.id);
    }
  }

  if (missingTrainingImageIds.length > 0) {
    await prisma.trainingImage.deleteMany({
      where: { id: { in: missingTrainingImageIds } },
    });
    orphanedDbRecords += missingTrainingImageIds.length;
  }

  const missingTicketImageIds: number[] = [];
  for (const img of ticketImages) {
    if (!fs.existsSync(resolveUpload(img.imagePath))) {
      missingTicketImageIds.push(img.id);
    }
  }

  if (missingTicketImageIds.length > 0) {
    await prisma.ticketImage.deleteMany({
      where: { id: { in: missingTicketImageIds } },
    });
    orphanedDbRecords += missingTicketImageIds.length;
  }

  // Files on disk not referenced in DB
  const uploadsDir = path.join(process.cwd(), "uploads");
  if (fs.existsSync(uploadsDir)) {
    const allDbPaths = new Set([
      ...trainingImages.map((i) => resolveUpload(i.imagePath)),
      ...ticketImages.map((i) => resolveUpload(i.imagePath)),
      ...trainingRevisionDocs
        .filter((r): r is { documentPath: string } => r.documentPath !== null)
        .map((r) => resolveUpload(r.documentPath)),
      ...complianceSettings.flatMap((s) =>
        parseStoredAttachments(s.value).map((a) => resolveUpload(a.path)),
      ),
      ...submissionFiles.map((f) => resolveUpload(f.filePath)),
    ]);

    const scanDir = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (!allDbPaths.has(fullPath)) {
          fs.unlinkSync(fullPath);
          orphanedFiles++;
        }
      }
    };

    for (const dir of MANAGED_DIRS) {
      const fullDir = path.join(uploadsDir, dir);
      if (fs.existsSync(fullDir)) scanDir(fullDir);
    }
  }

  return { orphanedDbRecords, orphanedFiles };
}
