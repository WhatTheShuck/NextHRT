import { describe, it, expect } from "vitest";
import {
  createSearchIndex,
  editDistance,
  fold,
  scoreFields,
} from "@/lib/search/fuzzy";

const titles = (items: { title: string }[], query: string) =>
  createSearchIndex(items, (i) => [{ text: i.title, weight: 1 }])
    .search(query)
    .map((m) => m.item.title);

const t = (...xs: string[]) => xs.map((title) => ({ title }));

describe("fold", () => {
  it("lower-cases and strips accents without shifting indices", () => {
    expect(fold("Zoë Ångström")).toBe("zoe angstrom");
    expect(fold("Zoë Ångström")).toHaveLength("Zoë Ångström".length);
  });
});

describe("editDistance", () => {
  it("counts an adjacent swap as one edit", () => {
    expect(editDistance("jhon", "john", 2)).toBe(1);
    expect(editDistance("kitten", "sitting", 3)).toBe(3);
  });

  it("bails out past the cap", () => {
    expect(editDistance("abc", "xyzxyz", 1)).toBe(2);
  });
});

describe("ranking", () => {
  it("prefers exact, then prefix, then word prefix, then mid-word", () => {
    const items = t(
      "Retraining",
      "Training Records",
      "Required Training",
      "Training",
    );
    expect(titles(items, "training")).toEqual([
      "Training",
      "Training Records",
      "Required Training",
      "Retraining",
    ]);
  });

  it("matches acronyms of word initials", () => {
    expect(
      titles(t("Admin Logs", "Training Needs Analysis", "Ticket Notes"), "tna"),
    ).toEqual(["Training Needs Analysis"]);
  });

  it("tolerates typos and transpositions", () => {
    expect(
      titles(t("John Smith", "Joan Smyth", "Mary Jones"), "jhon"),
    ).toContain("John Smith");
    expect(titles(t("Safety Induction", "Forklift"), "sefety")).toEqual([
      "Safety Induction",
    ]);
    expect(titles(t("Background Jobs"), "bakground")).toEqual([
      "Background Jobs",
    ]);
  });

  it("allows gappy subsequences but not coincidental ones", () => {
    expect(titles(t("Department Manager", "Dpt Mgr List"), "dptmgr")).toEqual([
      "Dpt Mgr List",
      "Department Manager",
    ]);
    expect(titles(t("Department Manager"), "dpt mgr")).toEqual([
      "Department Manager",
    ]);
    expect(titles(t("A long unrelated string of words"), "lns")).toEqual([]);
    // Real misses from the dev data: scattered letters that only look like a match.
    expect(titles(t("Operation of Pumps and Pipelines"), "adeline")).toEqual(
      [],
    );
    expect(titles(t("Grievance Resolution Policy"), "evac")).toEqual([]);
    expect(titles(t("Location Access Report"), "tna")).toEqual([]);
    expect(titles(t("O'Brien"), "obrien")).toEqual(["O'Brien"]);
  });

  it("requires every token to match (AND)", () => {
    expect(
      titles(
        t("Ticket Needs Analysis", "Training Needs Analysis"),
        "needs ticket",
      ),
    ).toEqual(["Ticket Needs Analysis"]);
  });

  it("ignores single-letter mid-word hits", () => {
    expect(titles(t("Banana", "Apple"), "n")).toEqual([]);
    expect(titles(t("Banana", "Apple"), "a")).toEqual(["Apple"]);
  });

  it("matches across fields, weighting the primary field highest", () => {
    const people = [
      { name: "Sam Lee", dept: "Safety" },
      { name: "Safety Sam", dept: "Finance" },
    ];
    const idx = createSearchIndex(people, (p) => [
      { text: p.name, weight: 1 },
      { text: p.dept, weight: 0.6 },
    ]);
    expect(idx.search("safety").map((m) => m.item.name)).toEqual([
      "Safety Sam",
      "Sam Lee",
    ]);
    expect(idx.search("sam finance").map((m) => m.item.name)).toEqual([
      "Safety Sam",
    ]);
  });

  it("keeps input order on ties and applies boosts", () => {
    const items = t("Alpha Report", "Beta Report");
    expect(titles(items, "report")).toEqual(["Alpha Report", "Beta Report"]);
    const boosted = createSearchIndex(items, (i) => [
      { text: i.title, weight: 1 },
    ]).search("report", {
      boost: (i) => (i.title.startsWith("Beta") ? 1.1 : 1),
    });
    expect(boosted[0].item.title).toBe("Beta Report");
  });

  it("splits camelCase into words", () => {
    expect(titles(t("McDonald"), "donald")[0]).toBe("McDonald");
  });

  it("returns nothing for an empty or punctuation-only query", () => {
    expect(titles(t("Anything"), "  ")).toEqual([]);
    expect(titles(t("Anything"), "--")).toEqual([]);
  });
});

describe("highlight ranges", () => {
  it("covers the matched characters in the original string", () => {
    const r = scoreFields("smi", [{ text: "Jo Smith", weight: 1 }]);
    expect(r?.ranges.get(0)).toEqual([[3, 6]]);
  });

  it("merges ranges from several tokens in the same field", () => {
    const r = scoreFields("needs analysis", [
      { text: "Training Needs Analysis", weight: 1 },
    ]);
    expect(r?.ranges.get(0)).toEqual([
      [9, 14],
      [15, 23],
    ]);
  });

  it("marks each initial for an acronym hit", () => {
    const r = scoreFields("tna", [
      { text: "Training Needs Analysis", weight: 1 },
    ]);
    expect(r?.ranges.get(0)).toEqual([
      [0, 1],
      [9, 10],
      [15, 16],
    ]);
  });
});
