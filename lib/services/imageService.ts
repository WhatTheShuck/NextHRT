import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import prisma from "@/lib/prisma";
import { UserRole } from "@/generated/prisma_client";
import { hasAccessToEmployee } from "@/lib/apiRBAC";

export class ImageService {
  async getImage(filePath: string, userId: string, userRole: UserRole) {
    // Security: Prevent directory traversal attacks
    if (filePath.includes("..") || filePath.includes("\\")) {
      throw new Error("INVALID_FILE_PATH");
    }

    if (filePath.startsWith("tickets/")) {
      const ticketImage = await prisma.ticketImage.findFirst({
        where: {
          imagePath: filePath,
        },
        include: {
          ticketRecord: {
            include: {
              ticketHolder: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  departmentId: true,
                },
              },
            },
          },
        },
      });

      if (!ticketImage) {
        throw new Error("IMAGE_NOT_FOUND");
      }

      const hasAccess = await hasAccessToEmployee(
        userId,
        ticketImage.ticketRecord.ticketHolder.id,
      );

      if (!hasAccess) {
        throw new Error("NOT_AUTHORISED");
      }
    } else if (filePath.startsWith("training/")) {
      const trainingRecord = await prisma.trainingRecords.findFirst({
        where: {
          imagePath: filePath,
        },
        include: {
          personTrained: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              departmentId: true,
            },
          },
        },
      });

      if (!trainingRecord) {
        throw new Error("IMAGE_NOT_FOUND");
      }

      const hasAccess = await hasAccessToEmployee(
        userId,
        trainingRecord.personTrained.id,
      );

      if (!hasAccess) {
        throw new Error("NOT_AUTHORISED");
      }
    } else {
      throw new Error("UNAUTHORISED_IMAGE_ACCESS");
    }

    // Construct full file path
    const fullPath = path.join(process.cwd(), "uploads", filePath);

    if (!existsSync(fullPath)) {
      throw new Error("FILE_NOT_FOUND");
    }

    const fileBuffer = await readFile(fullPath);

    const ext = path.extname(filePath).toLowerCase();
    let contentType = "application/octet-stream";

    switch (ext) {
      case ".jpg":
      case ".jpeg":
        contentType = "image/jpeg";
        break;
      case ".png":
        contentType = "image/png";
        break;
      case ".webp":
        contentType = "image/webp";
        break;
      case ".pdf":
        contentType = "application/pdf";
        break;
    }

    return { buffer: fileBuffer, contentType };
  }
}

export const imageService = new ImageService();
