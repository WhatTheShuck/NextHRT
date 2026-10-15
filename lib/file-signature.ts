// Magic-byte check for uploads anyone can now make (document submissions). The browser's
// declared MIME type is only a claim; the first bytes are what the file actually is.
export type SniffedType = "image/jpeg" | "image/png" | "image/webp" | "application/pdf";

const startsWith = (b: Uint8Array, sig: number[], offset = 0) =>
  b.length >= offset + sig.length && sig.every((v, i) => b[offset + i] === v);
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

export function sniffFileType(b: Uint8Array): SniffedType | null {
  if (startsWith(b, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(b, ascii("RIFF")) && startsWith(b, ascii("WEBP"), 8)) return "image/webp";
  if (startsWith(b, ascii("%PDF"))) return "application/pdf";
  return null;
}

export function matchesDeclaredType(declared: string, sniffed: SniffedType | null): boolean {
  if (sniffed === null) return false;
  const normalised = declared === "image/jpg" ? "image/jpeg" : declared;
  return normalised === sniffed;
}
