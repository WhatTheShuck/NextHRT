import { describe, it, expect, vi } from "vitest";
// Only the MAX_REQUEST_BYTES constant is needed from the service; don't load prisma/auth.
vi.mock("@/lib/services/documentSubmissionService", () => ({ MAX_REQUEST_BYTES: 30 * 1024 * 1024 }));
import { fieldsFromForm, editsSchema, errorResponse, readForm } from "@/lib/documentSubmissionHttp";

const form = (o: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(o)) fd.append(k, v);
  return fd;
};

describe("fieldsFromForm", () => {
  it("parses a ticket submission; blank optionals become null", () => {
    const r = fieldsFromForm(form({
      employeeId: "3", kind: "Ticket", itemId: "10",
      dateIssued: "2026-01-09T14:00:00.000Z", expiryDate: "", licenseNumber: " L1 ", provider: "",
    }));
    expect(r.success).toBe(true);
    expect(r.success && r.data).toMatchObject({ employeeId: 3, kind: "Ticket", itemId: 10, expiryDate: null, licenseNumber: "L1", provider: null });
  });

  it("rejects a bad kind or date", () => {
    expect(fieldsFromForm(form({ employeeId: "3", kind: "Other", itemId: "1", dateIssued: "x" })).success).toBe(false);
  });
});

describe("editsSchema", () => {
  it("accepts partial edits and explicit null expiry", () => {
    const r = editsSchema.safeParse({ itemId: 4, expiryDate: null });
    expect(r.success && r.data).toEqual({ itemId: 4, expiryDate: null });
  });
});

describe("readForm", () => {
  it("refuses an oversized body from Content-Length without reading it", async () => {
    const req = new Request("http://x", { method: "POST", headers: { "content-length": String(40 * 1024 * 1024) } });
    const r = await readForm(req);
    expect(r instanceof Response && r.status).toBe(413);
  });
  it("turns a non-multipart body into a 400", async () => {
    const req = new Request("http://x", { method: "POST", body: "{}", headers: { "content-type": "application/json" } });
    const r = await readForm(req);
    expect(r instanceof Response && r.status).toBe(400);
  });
});

describe("errorResponse", () => {
  it("maps service codes to statuses", async () => {
    expect(errorResponse(new Error("NOT_AUTHORISED")).status).toBe(403);
    expect(errorResponse(new Error("DUPLICATE_RECORD")).status).toBe(409);
    expect(errorResponse(new Error("INVALID_FILE_TYPE")).status).toBe(415);
    expect(errorResponse(new Error("boom")).status).toBe(500);
    expect(await errorResponse(new Error("PROVIDER_REQUIRED")).json()).toMatchObject({ code: "PROVIDER_REQUIRED" });
  });
});
