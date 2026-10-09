import { describe, it, expect } from "vitest";
import { safeReturnPath, buildReturnTo } from "@/lib/auth-return";

describe("safeReturnPath", () => {
  it("accepts same-origin paths", () => {
    expect(safeReturnPath("/forms/document-upload?kind=Ticket&itemId=3")).toBe("/forms/document-upload?kind=Ticket&itemId=3");
  });
  it("accepts a query and fragment", () => {
    expect(safeReturnPath("/forms/x?a=1#h")).toBe("/forms/x?a=1#h");
  });
  it("accepts double-encoded slashes, which stay a single path segment", () => {
    expect(safeReturnPath("/%252F%252Fevil.com")).toBe("/%252F%252Fevil.com");
  });
  it("rejects a path that normalises to a protocol-relative one", () => {
    expect(safeReturnPath("/.//evil.com")).toBeNull();
  });
  it("rejects anything that could leave the app", () => {
    for (const bad of ["//evil.com", "/\\evil.com", "https://evil.com", "evil.com", "", null, "/%2F%2Fevil.com", "/\t/evil.com", "/%09/evil.com", "/%5Cevil.com"]) {
      expect(safeReturnPath(bad as string | null)).toBeNull();
    }
  });
});

describe("buildReturnTo", () => {
  it("encodes the path and its query", () => {
    expect(buildReturnTo("/forms/document-upload", { kind: "Ticket", itemId: "3", junk: undefined })).toBe(
      "/auth?returnTo=%2Fforms%2Fdocument-upload%3Fkind%3DTicket%26itemId%3D3",
    );
  });
});
