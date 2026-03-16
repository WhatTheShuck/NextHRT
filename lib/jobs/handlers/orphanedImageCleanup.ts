import prisma from "@/lib/prisma";
import fs from "fs";
import path from "path";

export async function orphanedImageCleanupHandler(
  _payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  let orphanedDbRecords = 0;
  let orphanedFiles = 0;

  const [trainingImages, ticketImages] = await Promise.all([
    prisma.trainingImage.findMany({ select: { id: true, imagePath: true } }),
    prisma.ticketImage.findMany({ select: { id: true, imagePath: true } }),
  ]);

  // DB records whose file is missing on disk
  const missingTrainingImageIds: number[] = [];
  for (const img of trainingImages) {
    const fullPath = path.join(process.cwd(), img.imagePath);
    if (!fs.existsSync(fullPath)) {
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
    const fullPath = path.join(process.cwd(), img.imagePath);
    if (!fs.existsSync(fullPath)) {
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
      ...trainingImages.map((i) => path.resolve(process.cwd(), i.imagePath)),
      ...ticketImages.map((i) => path.resolve(process.cwd(), i.imagePath)),
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
