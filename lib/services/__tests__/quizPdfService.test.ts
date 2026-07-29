import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { renderQuizResponsePdf } from "@/lib/services/quizPdfService";
import type { QuizDocument } from "@/lib/quiz/schema";

const doc: QuizDocument = {
  version: 1,
  sections: [
    {
      id: "s0",
      title: "Welcome",
      items: [
        { id: "s0_info", type: "info", prompt: "Hi", body: "Intro" },
        {
          id: "s0_gate",
          type: "choice",
          prompt: "Your setup?",
          options: [
            { id: "laptop", label: "Laptop" },
            { id: "ipad", label: "iPad" },
          ],
        },
      ],
    },
    {
      id: "s1",
      title: "Laptop basics",
      showIf: { itemId: "s0_gate", in: ["laptop"] },
      items: [
        { id: "s1_scale", type: "scale", prompt: "Confidence?", scaleLabels: ["Low", "High"] },
        {
          id: "s1_know",
          type: "choice",
          prompt: "Where do files go?",
          options: [
            { id: "onedrive", label: "OneDrive", correct: true, coaching: "Use OneDrive." },
            { id: "cdrive", label: "C: drive" },
          ],
        },
        { id: "s1_text", type: "text", prompt: "Anything else?" },
      ],
    },
    {
      id: "s5",
      title: "iPad",
      showIf: { itemId: "s0_gate", in: ["ipad"] },
      items: [{ id: "s5_scale", type: "scale", prompt: "iPad ok?", scaleLabels: ["No", "Yes"] }],
    },
  ],
};

describe("renderQuizResponsePdf", () => {
  it("renders a valid PDF covering the taken branch", async () => {
    const bytes = await renderQuizResponsePdf({
      trainingTitle: "IT Induction",
      revisionLabel: "Rev 1",
      employeeName: "Jane Doe",
      completedAt: new Date("2026-07-09T00:00:00Z"),
      document: doc,
      answers: {
        s0_gate: { value: "laptop" },
        s1_scale: { value: 1 },
        s1_know: { value: "cdrive", wasCorrect: false },
        s1_text: { value: "Looking forward to it" },
      },
    });
    const parsed = await PDFDocument.load(bytes);
    expect(parsed.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it("survives non-WinAnsi characters in free-text answers", async () => {
    const bytes = await renderQuizResponsePdf({
      trainingTitle: "IT Induction",
      revisionLabel: "Rev 1",
      employeeName: "José 🙂 O’Brien",
      completedAt: new Date("2026-07-09T00:00:00Z"),
      document: doc,
      answers: {
        s0_gate: { value: "ipad" },
        s5_scale: { value: 1 },
        // Emoji + smart quotes + CJK — would throw if drawn unsanitised.
        s5_text: { value: "great 👍 “quotes” 日本語" },
      },
    });
    const parsed = await PDFDocument.load(bytes);
    expect(parsed.getPageCount()).toBeGreaterThanOrEqual(1);
  });
});
