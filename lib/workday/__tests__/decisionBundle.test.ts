import { describe, it, expect } from "vitest";
import { checkIdentity, decisionBundleSchema } from "../decisionBundle";

const source = {
  employees: { "1": "Philippe Olivier", "2": "Frederik Botma" },
  departments: { "6": "Management" },
};

describe("checkIdentity", () => {
  it("accepts a copy of the same HRT, including people added since", () => {
    const target = {
      employees: new Map([
        [1, "Philippe  OLIVIER"],
        [2, "Frederik Botma"],
        [3, "New Starter"],
      ]),
      departments: new Map([[6, "Management"]]),
    };
    expect(checkIdentity(source, target)).toEqual([]);
  });

  it("refuses a different HRT where ids point at other people or are missing", () => {
    const target = { employees: new Map([[1, "Someone Else"]]), departments: new Map<number, string>() };
    expect(checkIdentity(source, target)).toEqual([
      { kind: "employee", id: 1, expected: "Philippe Olivier", found: "Someone Else" },
      { kind: "employee", id: 2, expected: "Frederik Botma", found: null },
      { kind: "department", id: 6, expected: "Management", found: null },
    ]);
  });
});

describe("decisionBundleSchema", () => {
  it("rejects files that aren't an HRT decisions export", () => {
    expect(decisionBundleSchema.safeParse({ format: "something-else" }).success).toBe(false);
  });
});
