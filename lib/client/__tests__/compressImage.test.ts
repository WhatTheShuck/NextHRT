import { describe, it, expect } from "vitest";
import { fitWithin, jpegName, prepareUpload } from "@/lib/client/compressImage";

describe("fitWithin", () => {
  it("caps the longest edge at 2000, keeping the aspect ratio", () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 2000, height: 1500 });
    expect(fitWithin(3024, 4032)).toEqual({ width: 1500, height: 2000 });
  });
  it("never upscales", () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
});

describe("jpegName", () => {
  it("swaps the extension for .jpg", () => {
    expect(jpegName("IMG_0001.HEIC")).toBe("IMG_0001.jpg");
    expect(jpegName("scan.png")).toBe("scan.jpg");
    expect(jpegName(".png")).toBe("photo.jpg");
  });
});

describe("prepareUpload", () => {
  it("passes PDFs through untouched", async () => {
    const pdf = new File(["%PDF-1.7"], "cert.pdf", { type: "application/pdf" });
    expect(await prepareUpload(pdf)).toBe(pdf);
  });
  it("rejects other file types", async () => {
    await expect(prepareUpload(new File(["x"], "a.docx", { type: "application/msword" }))).rejects.toThrow("UNSUPPORTED_FILE");
  });
});
