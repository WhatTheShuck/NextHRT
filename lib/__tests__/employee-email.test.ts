import { describe, it, expect } from "vitest";
import { buildEmployeeEmail, emailNamePart } from "@/lib/employee-email";

describe("emailNamePart", () => {
  it("drops whitespace inside multi-part names", () => {
    expect(emailNamePart("Di Natale")).toBe("dinatale");
    expect(emailNamePart("  Van  der Berg ")).toBe("vanderberg");
  });
});

describe("buildEmployeeEmail", () => {
  it("builds firstname.lastname with spaces removed", () => {
    const email = buildEmployeeEmail("Cherie", "Di Natale");
    expect(email.split("@")[0]).toBe("cherie.dinatale");
  });
});
