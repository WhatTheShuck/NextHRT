import { describe, it, expect, vi, afterEach } from "vitest";
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

describe("prepareUpload with a (mocked) browser canvas", () => {
  function setup({ bitmap = vi.fn(), ctx = "ok" as "ok" | "null" } = {}) {
    const calls: string[] = [];
    const context = {
      fillStyle: "",
      imageSmoothingEnabled: false,
      imageSmoothingQuality: "low",
      fillRect: vi.fn(() => calls.push("fillRect")),
      drawImage: vi.fn(() => calls.push("drawImage")),
    };
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => (ctx === "ok" ? context : null)),
      toBlob: vi.fn((cb: (b: Blob | null) => void, type: string) => {
        calls.push(`toBlob ${canvas.width}x${canvas.height}`);
        cb(new Blob(["jpeg"], { type }));
      }),
    };
    vi.stubGlobal("createImageBitmap", bitmap);
    vi.stubGlobal("document", { createElement: vi.fn(() => canvas) });
    return { canvas, context, calls };
  }
  const goodBitmap = () => ({ width: 4032, height: 3024, close: vi.fn() });

  afterEach(() => vi.unstubAllGlobals());

  it("resizes to a .jpg on a white background with high-quality smoothing, then frees the canvas", async () => {
    const { canvas, context, calls } = setup({ bitmap: vi.fn().mockResolvedValue(goodBitmap()) });
    const out = await prepareUpload(new File(["x"], "scan.png", { type: "image/png" }));
    expect(out.name).toBe("scan.jpg");
    expect(out.type).toBe("image/jpeg");
    expect(context.fillStyle).toBe("#ffffff");
    expect(context.fillRect).toHaveBeenCalledWith(0, 0, 2000, 1500);
    expect(context.imageSmoothingQuality).toBe("high");
    expect(calls).toEqual(["fillRect", "drawImage", "toBlob 2000x1500"]);
    expect(canvas.width).toBe(0);
    expect(canvas.height).toBe(0);
  });

  it("retries without imageOrientation when the browser rejects that option", async () => {
    const bitmap = vi.fn().mockRejectedValueOnce(new TypeError("bad option")).mockResolvedValueOnce(goodBitmap());
    setup({ bitmap });
    const out = await prepareUpload(new File(["x"], "a.jpg", { type: "image/jpeg" }));
    expect(out.name).toBe("a.jpg");
    expect(bitmap).toHaveBeenCalledTimes(2);
    expect(bitmap.mock.calls[1]).toHaveLength(1);
  });

  it("throws IMAGE_DECODE_FAILED when both decode attempts fail", async () => {
    const bitmap = vi.fn().mockRejectedValue(new Error("nope"));
    setup({ bitmap });
    await expect(prepareUpload(new File(["x"], "a.jpg", { type: "image/jpeg" }))).rejects.toThrow("IMAGE_DECODE_FAILED");
    expect(bitmap).toHaveBeenCalledTimes(2);
  });

  it("throws IMAGE_DECODE_FAILED when no 2D context is available", async () => {
    setup({ bitmap: vi.fn().mockResolvedValue(goodBitmap()), ctx: "null" });
    await expect(prepareUpload(new File(["x"], "a.jpg", { type: "image/jpeg" }))).rejects.toThrow("IMAGE_DECODE_FAILED");
  });

  it("detects HEIC by name when the browser gives no MIME type", async () => {
    const bitmap = vi.fn().mockResolvedValue(goodBitmap());
    setup({ bitmap });
    const out = await prepareUpload(new File(["x"], "IMG_0001.HEIC", { type: "" }));
    expect(bitmap).toHaveBeenCalled();
    expect(out.name).toBe("IMG_0001.jpg");
  });

  it("re-types an empty-type .pdf as application/pdf so the server doesn't see octet-stream", async () => {
    const bitmap = vi.fn();
    setup({ bitmap });
    const pdf = new File(["%PDF-1.7"], "cert.PDF", { type: "", lastModified: 1234 });
    const out = await prepareUpload(pdf);
    expect(out).not.toBe(pdf);
    expect(out.name).toBe("cert.PDF");
    expect(out.type).toBe("application/pdf");
    expect(out.lastModified).toBe(1234);
    expect(await out.text()).toBe("%PDF-1.7");
    expect(bitmap).not.toHaveBeenCalled();
  });
});
