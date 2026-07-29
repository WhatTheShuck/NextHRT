import prisma from "@/lib/prisma";
import fs from "fs";
import path from "path";

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

  const [trainingImages, ticketImages, trainingRevisionDocs] = await Promise.all([
    prisma.trainingImage.findMany({ select: { id: true, imagePath: true } }),
    prisma.ticketImage.findMany({ select: { id: true, imagePath: true } }),
    prisma.trainingRevision.findMany({
      where: { documentPath: { not: null } },
      select: { documentPath: true },
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

    scanDir(uploadsDir);
  }

  return { orphanedDbRecords, orphanedFiles };
}
