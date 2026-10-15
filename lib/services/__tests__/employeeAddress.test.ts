import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/data", () => ({ companyDetails: { domain_extension: "ksb.com.au" } }));
import { employeeAddress, employeeDisplayName } from "@/lib/services/employeeAddress";

const base = { legalFirstName: "Jonathan", legalLastName: "Di Natale", preferredFirstName: "Jono", preferredLastName: null };

describe("employeeAddress", () => {
  it("prefers the linked login's email", () => {
    expect(employeeAddress({ ...base, User: { email: "j@x.com" } })).toBe("j@x.com");
  });
  it("falls back to firstname.lastname@ using preferred ?? legal names", () => {
    expect(employeeAddress({ ...base, User: null })).toBe("jono.dinatale@ksb.com.au");
  });
  it("display name uses preferred ?? legal", () => {
    expect(employeeDisplayName(base)).toBe("Jono Di Natale");
  });
});
