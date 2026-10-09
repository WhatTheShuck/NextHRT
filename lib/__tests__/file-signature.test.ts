import { describe, it, expect } from "vitest";
import { sniffFileType, matchesDeclaredType } from "@/lib/file-signature";

const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)]);
const ascii = (s: string) => new Uint8Array([...s].map((c) => c.charCodeAt(0)));

describe("sniffFileType", () => {
  it("recognises JPEG, PNG, WebP, PDF", () => {
    expect(sniffFileType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(sniffFileType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
    expect(sniffFileType(ascii("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
    expect(sniffFileType(ascii("%PDF-1.7\n"))).toBe("application/pdf");
  });

  it("returns null for anything else", () => {
    expect(sniffFileType(ascii("<html><script>"))).toBeNull();
    expect(sniffFileType(new Uint8Array([]))).toBeNull();
  });
});

describe("matchesDeclaredType", () => {
  it("treats image/jpg as image/jpeg", () => {
    expect(matchesDeclaredType("image/jpg", "image/jpeg")).toBe(true);
  });
  it("rejects a mismatch", () => {
    expect(matchesDeclaredType("application/pdf", "image/png")).toBe(false);
    expect(matchesDeclaredType("image/png", null)).toBe(false);
  });
});
