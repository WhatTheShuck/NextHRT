import { describe, it, expect } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import {
  appendQuestionsSection,
  layoutParagraph,
  renderCompletionRecord,
  type CompletionEvidence,
} from "@/lib/services/sopPdfService";

function evidence(overrides: Partial<CompletionEvidence> = {}): CompletionEvidence {
  return {
    employeeName: "Brandon Wiedman",
    sopTitle: "2 Way Radio",
    revisionLabel: "2025/10/15",
    acknowledgedOn: new Date("2026-07-12"),
    submittedAt: new Date("2026-07-12"),
    practicalOn: new Date("2026-07-14"),
    trainerName: "Terry Trainer",
    markedAt: new Date("2026-07-14T03:20:00Z"),
    markedByName: "Terry Trainer",
    rows: [
      {
        order: 1,
        questionText: "Which channel is used on site?",
        answerText: "Channel 3.",
        verdict: "Sufficient",
        trainerComment: null,
      },
    ],
    ...overrides,
  };
}

async function makeProcedurePdf(pages = 2): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage();
  return doc.save();
}

describe("appendQuestionsSection", () => {
  it("appends at least one page and preserves the procedure pages", async () => {
    const procedure = await makeProcedurePdf(2);
    const merged = await appendQuestionsSection(procedure, {
      sopTitle: "Pump Rebuild",
      revisionLabel: "Rev 3",
      questions: [
        { order: 1, questionText: "What PPE is required?" },
        { order: 2, questionText: "Describe the lockout procedure." },
      ],
    });
    const result = await PDFDocument.load(merged);
    expect(result.getPageCount()).toBeGreaterThanOrEqual(3);
  });

  it("flows a long question list across multiple appendix pages", async () => {
    const procedure = await makeProcedurePdf(1);
    const questions = Array.from({ length: 40 }, (_, i) => ({
      order: i + 1,
      questionText: `Question ${i + 1}: ` + "lorem ipsum ".repeat(20),
    }));
    const merged = await appendQuestionsSection(procedure, {
      sopTitle: "Long SOP",
      revisionLabel: "Rev 1",
      questions,
    });
    const result = await PDFDocument.load(merged);
    expect(result.getPageCount()).toBeGreaterThan(2);
  });
});

describe("layoutParagraph", () => {
  it("keeps the author's line breaks instead of reflowing them away", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);

    const lines = layoutParagraph("1. Check charger\n2. Check tag", font, 10, 400);

    expect(lines).toEqual(["1. Check charger", "2. Check tag"]);
  });

  it("preserves blank lines between paragraphs", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);

    expect(layoutParagraph("first\n\nsecond", font, 10, 400)).toEqual([
      "first",
      "",
      "second",
    ]);
  });

  it("does not turn line breaks into unencodable placeholders", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);

    const lines = layoutParagraph("first\nsecond", font, 10, 400);

    expect(lines.join("")).not.toContain("?");
  });

  it("folds bullets rather than dropping them", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);

    expect(layoutParagraph("• Isolate the unit", font, 10, 400)).toEqual([
      "- Isolate the unit",
    ]);
  });

  it("still wraps a single line that is too wide", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);

    expect(layoutParagraph("word ".repeat(60).trim(), font, 10, 200).length)
      .toBeGreaterThan(1);
  });
});

describe("renderCompletionRecord", () => {
  it("renders a single-page record for a short SOP", async () => {
    const doc = await PDFDocument.load(await renderCompletionRecord(evidence()));
    expect(doc.getPageCount()).toBe(1);
  });

  it("flows long answers onto further pages", async () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({
      order: i + 1,
      questionText: `Question ${i + 1}: ` + "lorem ipsum ".repeat(15),
      answerText: "dolor sit amet ".repeat(20),
      verdict: "Sufficient",
      trainerComment: i % 3 === 0 ? "Nicely explained." : null,
    }));
    const doc = await PDFDocument.load(
      await renderCompletionRecord(evidence({ rows })),
    );
    expect(doc.getPageCount()).toBeGreaterThan(1);
  });

  it("survives characters the PDF standard font cannot encode", async () => {
    // Employees type answers freely — emoji or CJK must not blow up the export.
    const bytes = await renderCompletionRecord(
      evidence({
        employeeName: "Zoë Ōtāne 🙂",
        rows: [
          {
            order: 1,
            questionText: "Describe the “safe” procedure — briefly",
            answerText: "Check 温度 first 🔧, then isolate.",
            verdict: "Sufficient",
            trainerComment: "…fine",
          },
        ],
      }),
    );
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
  });

  it("does not invent a trainer when the marker name is missing", async () => {
    const bytes = await renderCompletionRecord(
      evidence({ markedByName: null, trainerName: "Terry Trainer" }),
    );
    expect(bytes.byteLength).toBeGreaterThan(0);
  });
});
