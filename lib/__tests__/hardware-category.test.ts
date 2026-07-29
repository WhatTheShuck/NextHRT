import { describe, it, expect } from "vitest";
import {
  getSnipeCategoryName,
  isPhoneCategory,
  isTabletCategory,
  hardwareItemOptions,
} from "@/lib/hardware-category";

function item(name: string, categoryName?: string) {
  return {
    name,
    payloadTemplate:
      categoryName === undefined
        ? null
        : JSON.stringify({ categoryId: 1, categoryName }),
  };
}

describe("getSnipeCategoryName", () => {
  it("prefers the payloadTemplate category over the display name", () => {
    // "iPad" is shown to managers, but the Snipe category is "Tablet".
    expect(getSnipeCategoryName(item("iPad", "Tablet"))).toBe("Tablet");
  });

  it("falls back to the display name when no/blank/broken template", () => {
    expect(getSnipeCategoryName(item("Laptop"))).toBe("Laptop");
    expect(getSnipeCategoryName({ name: "Phone", payloadTemplate: "{bad" })).toBe(
      "Phone",
    );
  });
});

describe("category detection", () => {
  it("detects phones (and excludes headphones)", () => {
    expect(isPhoneCategory("Phone")).toBe(true);
    expect(isPhoneCategory("iPhone")).toBe(true);
    expect(isPhoneCategory("Headphones")).toBe(false);
    expect(isPhoneCategory("Laptop")).toBe(false);
  });

  it("detects tablets", () => {
    expect(isTabletCategory("Tablet")).toBe(true);
    expect(isTabletCategory("iPad")).toBe(true);
    expect(isTabletCategory("Laptop")).toBe(false);
  });
});

describe("hardwareItemOptions", () => {
  it("laptop exposes no phone/tablet options", () => {
    expect(hardwareItemOptions(item("Laptop", "Laptop"), false)).toEqual({
      showCallText: false,
      showNeedsData: false,
      showNumberOption: false,
      allowNoNumber: false,
    });
  });

  it("phone always shows the number choice and allows 'no number'", () => {
    expect(hardwareItemOptions(item("Phone", "Phone"), false)).toEqual({
      showCallText: false,
      showNeedsData: false,
      showNumberOption: true,
      allowNoNumber: true,
    });
  });

  it("tablet shows call/text + data; number choice only with a SIM, and never 'no number'", () => {
    const ipad = item("iPad", "Tablet");
    // No data SIM → no number choice.
    expect(hardwareItemOptions(ipad, false)).toEqual({
      showCallText: true,
      showNeedsData: true,
      showNumberOption: false,
      allowNoNumber: false,
    });
    // Data SIM on → number choice appears, but "no number" is not allowed.
    expect(hardwareItemOptions(ipad, true)).toEqual({
      showCallText: true,
      showNeedsData: true,
      showNumberOption: true,
      allowNoNumber: false,
    });
  });
});
