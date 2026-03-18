import { writeFile, mkdir, unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { FILE_UPLOAD_CONFIG } from "@/lib/file-config";

export class FileUploadService {
  validateFile(file: File): void {
    if (!FILE_UPLOAD_CONFIG.ALLOWED_TYPES.includes(file.type)) {
      throw new Error("INVALID_FILE_TYPE");
    }
    if (file.size > FILE_UPLOAD_CONFIG.MAX_FILE_SIZE) {
      throw new Error("FILE_TOO_LARGE");
    }
  }

  async saveFile(
    file: File,
    subDir: string,
  ): Promise<{ imagePath: string; imageType: string }> {
    this.validateFile(file);

    try {
      const uploadDir = path.join(process.cwd(), "uploads", subDir);
      if (!existsSync(uploadDir)) {
        await mkdir(uploadDir, { recursive: true });
      }

      const fileExtension = path.extname(file.name);
      const uniqueFilename = `${uuidv4()}${fileExtension}`;
      const filePath = path.join(uploadDir, uniqueFilename);

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      await writeFile(filePath, buffer);

      return {
        imagePath: `${subDir}/${uniqueFilename}`,
        imageType: file.type,
      };
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message === "INVALID_FILE_TYPE" ||
          error.message === "FILE_TOO_LARGE")
      ) {
        throw error;
      }
      throw new Error("FILE_SAVE_ERROR");
    }
  }

  async saveFiles(
    files: File[],
    subDir: string,
  ): Promise<
    Array<{ imagePath: string; imageType: string; originalName: string }>
  > {
    const savedImages: Array<{
      imagePath: string;
      imageType: string;
      originalName: string;
    }> = [];

    for (const file of files) {
      if (file && file.size > 0) {
        this.validateFile(file);
      }
    }

    try {
      const uploadDir = path.join(process.cwd(), "uploads", subDir);
      if (!existsSync(uploadDir)) {
        await mkdir(uploadDir, { recursive: true });
      }

      for (const file of files) {
        if (file && file.size > 0) {
          const fileExtension = path.extname(file.name);
          const uniqueFilename = `${uuidv4()}${fileExtension}`;
          const filePath = path.join(uploadDir, uniqueFilename);

          const bytes = await file.arrayBuffer();
          const buffer = Buffer.from(bytes);
          await writeFile(filePath, buffer);

          savedImages.push({
            imagePath: `${subDir}/${uniqueFilename}`,
            imageType: file.type,
            originalName: file.name,
          });
        }
      }

      return savedImages;
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message === "INVALID_FILE_TYPE" ||
          error.message === "FILE_TOO_LARGE")
      ) {
        throw error;
      }
      throw new Error("FILE_SAVE_ERROR");
    }
  }

  async deleteFile(relativePath: string): Promise<void> {
    try {
      const fullPath = path.join(process.cwd(), "uploads", relativePath);
      if (existsSync(fullPath)) {
        await unlink(fullPath);
      }
    } catch (error) {
      console.error("Error cleaning up file:", error);
    }
  }

  async deleteFiles(relativePaths: string[]): Promise<void> {
    for (const relativePath of relativePaths) {
      await this.deleteFile(relativePath);
    }
  }
}

export const fileUploadService = new FileUploadService();
