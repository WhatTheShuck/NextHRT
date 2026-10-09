import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import {
  QuizDocumentSchema,
  QuizDocumentShapeSchema,
  type QuizDocument,
} from "@/lib/quiz/schema";
import {
  convertItem,
  describeIssues,
  gateCandidates,
  isRenderable,
  move,
  newItem,
  newOptionId,
  newSection,
  starterDocument,
  ITEM_TYPES,
} from "@/lib/quiz/editor";

function doc(): QuizDocument {
  return {
    version: 1,
    sections: [
      {
        id: "s0",
        title: "Welcome",
        items: [
          {
            id: "gate",
            type: "choice",
            prompt: "Setup?",
            options: [
              { id: "laptop", label: "Laptop" },
              { id: "ipad", label: "iPad" },
            ],
          },
        ],
      },
      {
        id: "s1",
        title: "Laptop",
        showIf: { itemId: "gate", in: ["laptop"] },
        items: [{ id: "t", type: "text", prompt: "Anything else?" }],
      },
    ],
  };
}

describe("newItem", () => {
  it("creates a structurally valid item of every type", () => {
    for (const { type } of ITEM_TYPES) {
      const d = doc();
      d.sections[0].items.push(newItem(type, `new_${type}`));
      const r = QuizDocumentShapeSchema.safeParse(d);
      // Blank prompts are expected; nothing else should be wrong.
      expect(r.success || isRenderable(r.error.issues)).toBe(true);
    }
  });
});

describe("convertItem", () => {
  it("keeps id, prompt and option ids from choice to pick-any, dropping the answer key", () => {
    const out = convertItem(
      {
        id: "q",
        type: "choice",
        prompt: "Pick",
        options: [
          { id: "a", label: "A", correct: true, coaching: "tip" },
          { id: "b", label: "B" },
        ],
      },
      "multiselect",
    );
    expect(out).toEqual({
      id: "q",
      type: "multiselect",
      prompt: "Pick",
      options: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
      ],
    });
  });

  it("turns scale labels into options and back", () => {
    const choice = convertItem(
      { id: "q", type: "scale", prompt: "Rate", scaleLabels: ["Low", "High"] },
      "choice",
    );
    expect(choice.type === "choice" && choice.options.map((o) => o.label)).toEqual(["Low", "High"]);
    const scale = convertItem(choice, "scale");
    expect(scale.type === "scale" && scale.scaleLabels).toEqual(["Low", "High"]);
  });

  it("returns the item untouched when the type is unchanged", () => {
    const item = doc().sections[0].items[0];
    expect(convertItem(item, "choice")).toBe(item);
  });
});

describe("helpers", () => {
  it("newOptionId skips ids already taken", () => {
    expect(newOptionId([{ id: "opt1" }, { id: "opt3" }])).toBe("opt4");
    expect(newOptionId([{ id: "opt1" }, { id: "x" }])).toBe("opt3");
  });

  it("move reorders and ignores out-of-range targets", () => {
    expect(move([1, 2, 3], 0, 2)).toEqual([2, 3, 1]);
    const arr = [1, 2];
    expect(move(arr, 0, -1)).toBe(arr);
  });

  it("newSection gets ids unique across the document", () => {
    const d = doc();
    const s = newSection(d);
    expect(["s0", "s1"]).not.toContain(s.id);
    expect(s.items[0].id).not.toBe("gate");
  });

  it("gateCandidates only offers choice items from earlier sections", () => {
    const d = doc();
    expect(gateCandidates(d, 0)).toEqual([]);
    expect(gateCandidates(d, 1).map((g) => g.id)).toEqual(["gate"]);
  });

  it("the starter document only needs its blank fields filled in", () => {
    const r = QuizDocumentSchema.safeParse(starterDocument());
    expect(r.success).toBe(false);
    expect(isRenderable(r.error!.issues)).toBe(true);
  });

  it("the seeded IT induction questionnaire is renderable as-is", () => {
    const raw = readFileSync(
      path.join(process.cwd(), "prisma", "seed-data", "it-induction-quiz.json"),
      "utf8",
    );
    expect(QuizDocumentShapeSchema.safeParse(JSON.parse(raw)).success).toBe(true);
  });
});

describe("isRenderable", () => {
  it("rejects documents with structural problems", () => {
    const bad = { version: 1, sections: [{ id: "s", title: "S", items: [{ id: "i", type: "nope" }] }] };
    const r = QuizDocumentShapeSchema.safeParse(bad);
    expect(r.success).toBe(false);
    expect(isRenderable(r.error!.issues)).toBe(false);
  });
});

describe("describeIssues", () => {
  it("names the section, question and field", () => {
    const d = doc();
    d.sections[1].items[0].prompt = "";
    const r = QuizDocumentSchema.safeParse(d);
    expect(describeIssues(d, r.error!.issues)).toEqual([
      'Section 2 "Laptop" › Question 1: question text is empty',
    ]);
  });

  it("describes option and branch problems", () => {
    const d = doc();
    const gate = d.sections[0].items[0];
    if (gate.type === "choice") gate.options[1].label = "";
    d.sections[1].showIf = { itemId: "gate", in: [] };
    const r = QuizDocumentSchema.safeParse(d);
    expect(describeIssues(d, r.error!.issues)).toEqual(
      expect.arrayContaining([
        'Section 1 "Welcome" › Question 1 › Option 2: label is empty',
        'Section 2 "Laptop" › Show only if: pick at least one answer',
      ]),
    );
  });
});
