import { describe, it, expect } from "vitest";
import { resolveSopPairs } from "@/lib/sop/pairing";

const t = (id: number, title: string, sopPartnerId: number | null = null) => ({
  id,
  title,
  sopPartnerId,
});

describe("resolveSopPairs", () => {
  it("pairs a Task Sheet with its Practical by base title", () => {
    const res = resolveSopPairs([
      t(1, "Pump Rebuild - Task Sheet"),
      t(2, "Pump Rebuild - Practical"),
    ]);
    expect(res.pairs).toEqual([
      { taskSheetId: 1, practicalId: 2, baseTitle: "Pump Rebuild" },
    ]);
    expect(res.orphans).toEqual([]);
  });

  it("reports a Task Sheet with no Practical twin as an orphan — never guesses", () => {
    const res = resolveSopPairs([t(1, "Pump Rebuild - Task Sheet")]);
    expect(res.pairs).toEqual([]);
    expect(res.orphans).toEqual([
      { id: 1, title: "Pump Rebuild - Task Sheet", reason: "missing Practical twin" },
    ]);
  });

  it("reports a Practical with no Task Sheet twin as an orphan", () => {
    const res = resolveSopPairs([t(2, "Pump Rebuild - Practical")]);
    expect(res.orphans).toEqual([
      { id: 2, title: "Pump Rebuild - Practical", reason: "missing Task Sheet twin" },
    ]);
  });

  it("reports titles without a recognised suffix", () => {
    const res = resolveSopPairs([t(3, "Pump Rebuild")]);
    expect(res.orphans).toEqual([
      { id: 3, title: "Pump Rebuild", reason: "no recognised suffix" },
    ]);
  });

  it("reports duplicate base titles as ambiguous instead of pairing", () => {
    const res = resolveSopPairs([
      t(1, "Pump Rebuild - Task Sheet"),
      t(2, "Pump Rebuild - Task Sheet"),
      t(3, "Pump Rebuild - Practical"),
    ]);
    expect(res.pairs).toEqual([]);
    expect(res.orphans.map((o) => o.reason)).toEqual([
      "ambiguous: duplicate titles",
      "ambiguous: duplicate titles",
      "ambiguous: duplicate titles",
    ]);
  });

  it("skips pairs that are already linked", () => {
    const res = resolveSopPairs([
      t(1, "Pump Rebuild - Task Sheet", 2),
      t(2, "Pump Rebuild - Practical"),
    ]);
    expect(res.pairs).toEqual([]);
    expect(res.alreadyLinked).toEqual([1]);
  });

  it("reports a Task Sheet linked to a different training", () => {
    const res = resolveSopPairs([
      t(1, "Pump Rebuild - Task Sheet", 99),
      t(2, "Pump Rebuild - Practical"),
    ]);
    expect(res.pairs).toEqual([]);
    expect(res.orphans).toEqual([
      {
        id: 1,
        title: "Pump Rebuild - Task Sheet",
        reason: "already linked to a different training (99)",
      },
    ]);
  });
});
