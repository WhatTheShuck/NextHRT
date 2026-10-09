// Shrinks phone photos in the browser before upload (spec decision 6): longest edge 2000px,
// JPEG q0.85, renamed .jpg so the stored extension and served Content-Type are right.
// PDFs pass through and are checked against the normal size cap on the server.

export const MAX_EDGE = 2000;
export const JPEG_QUALITY = 0.85;

export function fitWithin(width: number, height: number, max = MAX_EDGE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

export function jpegName(name: string): string {
  const base = name.replace(/\.[^.]*$/, "");
  return `${base || "photo"}.jpg`;
}

const isHeic = (f: File) => /image\/hei[cf]/.test(f.type) || /\.hei[cf]$/i.test(f.name);
// Some browsers/pickers give no MIME type; trust the extension then (the server sniffs bytes anyway).
const isPdf = (f: File) => f.type === "application/pdf" || (f.type === "" && /\.pdf$/i.test(f.name));

/** Decode honouring EXIF orientation; older browsers reject the option, so retry once without it. */
async function decode(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    try {
      return await createImageBitmap(file);
    } catch {
      throw new Error("IMAGE_DECODE_FAILED");
    }
  }
}

/**
 * Throws UNSUPPORTED_FILE (not an image or PDF) or IMAGE_DECODE_FAILED (the browser can't read
 * it; on iPhone, set Camera → Formats → Most Compatible, or pick the photo as JPEG).
 */
export async function prepareUpload(file: File): Promise<File> {
  if (isPdf(file)) return file;
  if (!file.type.startsWith("image/") && !isHeic(file)) throw new Error("UNSUPPORTED_FILE");

  const bitmap = await decode(file);
  const { width, height } = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  try {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("IMAGE_DECODE_FAILED");
    // JPEG has no alpha: paint white first so transparent PNGs don't come out black.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    if (!blob) throw new Error("IMAGE_DECODE_FAILED");
    return new File([blob], jpegName(file.name), { type: "image/jpeg", lastModified: Date.now() });
  } finally {
    bitmap.close();
    // Release the backing store now; iOS Safari caps total canvas memory.
    canvas.width = canvas.height = 0;
  }
}
