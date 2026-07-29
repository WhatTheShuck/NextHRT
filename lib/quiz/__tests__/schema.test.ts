import { describe, it, expect } from "vitest";
import {
  QuizDocumentSchema,
  parseQuizDocument,
  visibleItems,
  stripAnswerKey,
  type QuizDocument,
} from "@/lib/quiz/schema";

// A valid document exercising every item type + a branch gate.
function validDoc(): QuizDocument {
  return {
    version: 1,
    sections: [
      {
        id: "s0",
        title: "Welcome",
        items: [
          {
            id: "welcome",
            type: "info",
            prompt: "Welcome",
            body: "Not a test.",
          },
          {
            id: "gate",
            type: "choice",
            prompt: "Your main setup?",
            options: [
              { id: "laptop", label: "Company laptop" },
              { id: "ipad", label: "iPad only" },
            ],
          },
        ],
      },
      {
        id: "s1",
        title: "Laptop track",
        showIf: { itemId: "gate", in: ["laptop"] },
        items: [
          {
            id: "onedrive",
            type: "scale",
            prompt: "OneDrive?",
            scaleLabels: ["Never", "A bit", "Confidently"],
          },
          {
            id: "photos",
            type: "choice",
            prompt: "Phone photos to laptop?",
            options: [
              { id: "camupload", label: "OneDrive camera upload", correct: true, coaching: "Enable it." },
              { id: "email", label: "Email to self" },
            ],
          },
          {
            id: "apps",
            type: "multiselect",
            prompt: "Which have you used?",
            options: [
              { id: "word", label: "Word" },
              { id: "excel", label: "Excel" },
            ],
          },
          {
            id: "frustration",
            type: "text",
            prompt: "Anything frustrating?",
            optional: true,
          },
        ],
      },
    ],
  };
}

describe("QuizDocumentSchema", () => {
  it("accepts a valid document", () => {
    expect(QuizDocumentSchema.safeParse(validDoc()).success).toBe(true);
  });

  it("rejects duplicate item ids across sections", () => {
    const doc = validDoc();
    doc.sections[1].items[0].id = "gate"; // collide with S0 gate
    expect(QuizDocumentSchema.safeParse(doc).success).toBe(false);
  });

  it("rejects duplicate option ids within an item", () => {
    const doc = validDoc();
    (doc.sections[0].items[1] as { options: { id: string; label: string }[] }).options[1].id = "laptop";
    expect(QuizDocumentSchema.safeParse(doc).success).toBe(false);
  });

  it("rejects showIf referencing a later item", () => {
    const doc = validDoc();
    // point S1's showIf at an item defined inside S1 itself (not earlier)
    doc.sections[1].showIf = { itemId: "onedrive", in: ["x"] };
    expect(QuizDocumentSchema.safeParse(doc).success).toBe(false);
  });

  it("rejects showIf referencing a non-choice item", () => {
    const doc = validDoc();
    doc.sections[1].showIf = { itemId: "welcome", in: ["laptop"] };
    expect(QuizDocumentSchema.safeParse(doc).success).toBe(false);
  });

  it("rejects showIf with an unknown option id", () => {
    const doc = validDoc();
    doc.sections[1].showIf = { itemId: "gate", in: ["nope"] };
    expect(QuizDocumentSchema.safeParse(doc).success).toBe(false);
  });

  it("rejects a choice with two correct options", () => {
    const doc = validDoc();
    const photos = doc.sections[1].items[1] as { options: { correct?: boolean }[] };
    photos.options[1].correct = true;
    expect(QuizDocumentSchema.safeParse(doc).success).toBe(false);
  });

  it("rejects coaching on a multiselect option", () => {
    const doc = validDoc();
    const apps = doc.sections[1].items[2] as { options: Record<string, unknown>[] };
    apps.options[0].coaching = "nope";
    expect(QuizDocumentSchema.safeParse(doc).success).toBe(false);
  });

  it("rejects correct on a multiselect option", () => {
    const doc = validDoc();
    const apps = doc.sections[1].items[2] as { options: Record<string, unknown>[] };
    apps.options[0].correct = true;
    expect(QuizDocumentSchema.safeParse(doc).success).toBe(false);
  });

  it("rejects coaching on an option of a choice with no correct option", () => {
    const doc = validDoc();
    const gate = doc.sections[0].items[1] as { options: Record<string, unknown>[] };
    gate.options[0].coaching = "nope";
    expect(QuizDocumentSchema.safeParse(doc).success).toBe(false);
  });

  it("rejects optional on a non-text item", () => {
    const doc = validDoc();
    (doc.sections[1].items[0] as Record<string, unknown>).optional = true;
    expect(QuizDocumentSchema.safeParse(doc).success).toBe(false);
  });

  it("requires body on info items", () => {
    const doc = validDoc();
    delete (doc.sections[0].items[0] as Record<string, unknown>).body;
    expect(QuizDocumentSchema.safeParse(doc).success).toBe(false);
  });

  it("requires at least two scale labels", () => {
    const doc = validDoc();
    (doc.sections[1].items[0] as { scaleLabels: string[] }).scaleLabels = ["only one"];
    expect(QuizDocumentSchema.safeParse(doc).success).toBe(false);
  });

  it("requires at least two options on a choice", () => {
    const doc = validDoc();
    (doc.sections[0].items[1] as { options: unknown[] }).options = [{ id: "a", label: "A" }];
    expect(QuizDocumentSchema.safeParse(doc).success).toBe(false);
  });

  it("parseQuizDocument throws on invalid JSON string", () => {
    expect(() => parseQuizDocument("{ not json")).toThrow();
  });

  it("parseQuizDocument returns the document for valid JSON", () => {
    const parsed = parseQuizDocument(JSON.stringify(validDoc()));
    expect(parsed.sections).toHaveLength(2);
  });
});

describe("visibleItems", () => {
  it("includes no-showIf sections always and matching-gate sections", () => {
    const items = visibleItems(validDoc(), { gate: "laptop" });
    const ids = items.map((i) => i.item.id);
    expect(ids).toEqual(["welcome", "gate", "onedrive", "photos", "apps", "frustration"]);
  });

  it("omits showIf sections when the gate answer excludes them", () => {
    const items = visibleItems(validDoc(), { gate: "ipad" });
    expect(items.map((i) => i.item.id)).toEqual(["welcome", "gate"]);
  });

  it("omits showIf sections when the gate is unanswered", () => {
    const items = visibleItems(validDoc(), {});
    expect(items.map((i) => i.item.id)).toEqual(["welcome", "gate"]);
  });
});

describe("stripAnswerKey", () => {
  it("removes correct and coaching from every option and leaves the original intact", () => {
    const doc = validDoc();
    const stripped = stripAnswerKey(doc);
    const strippedPhotos = stripped.sections[1].items[1] as { options: Record<string, unknown>[] };
    expect(strippedPhotos.options[0]).not.toHaveProperty("correct");
    expect(strippedPhotos.options[0]).not.toHaveProperty("coaching");
    // original untouched
    const origPhotos = doc.sections[1].items[1] as { options: Record<string, unknown>[] };
    expect(origPhotos.options[0]).toHaveProperty("correct", true);
    expect(origPhotos.options[0]).toHaveProperty("coaching");
  });
});
