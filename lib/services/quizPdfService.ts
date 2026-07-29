import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { visibleItems, type QuizDocument, type QuizItem } from "@/lib/quiz/schema";

// Answers are stored as { value, wasCorrect? }; wasCorrect is only present for
// knowledge choice items (choices carrying a correct option).
interface StoredAnswer {
  value: unknown;
  wasCorrect?: boolean;
}

export interface QuizPdfInput {
  trainingTitle: string;
  revisionLabel: string;
  employeeName: string;
  completedAt: Date;
  document: QuizDocument;
  answers: Record<string, StoredAnswer>;
}

const PAGE_MARGIN = 50;
const TITLE_SIZE = 16;
const META_SIZE = 10;
const PROMPT_SIZE = 11;
const ANSWER_SIZE = 11;
const LINE_GAP = 4;
const BLOCK_GAP = 10;
const SECTION_SIZE = 12;

const MUTED = rgb(0.35, 0.35, 0.35);
const WRONG = rgb(0.7, 0.35, 0.05);

/**
 * pdf-lib's standard fonts use WinAnsi encoding and throw on characters outside
 * it (emoji, CJK, etc. — reachable via free-text answers). Normalise the common
 * smart punctuation and drop anything else non-Latin-1 so evidence generation
 * can never fail on user input.
 */
function safe(text: string): string {
  return text
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/–/g, "-")
    .replace(/—/g, "--")
    .replace(/…/g, "...")
    .replace(/[^\x0A\x20-\x7E\xA0-\xFF]/g, "");
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  // Preserve author/employee line breaks, then wrap each paragraph on words.
  for (const paragraph of safe(text).split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

/** The employee's answer to one item, rendered for evidence, or null to skip. */
function describeAnswer(
  item: QuizItem,
  stored: StoredAnswer | undefined,
): { text: string; wrong?: boolean } | null {
  switch (item.type) {
    case "info":
      return null;
    case "scale": {
      const idx = stored?.value;
      if (typeof idx === "number" && item.scaleLabels[idx] !== undefined) {
        return { text: item.scaleLabels[idx] };
      }
      return { text: "(no answer)" };
    }
    case "multiselect": {
      const picked = Array.isArray(stored?.value) ? (stored?.value as string[]) : [];
      const labels = picked
        .map((id) => item.options.find((o) => o.id === id)?.label)
        .filter((l): l is string => Boolean(l));
      return { text: labels.length ? labels.join(", ") : "(none selected)" };
    }
    case "text": {
      const v = typeof stored?.value === "string" ? stored.value : "";
      return { text: v.trim() ? v : "(no answer)" };
    }
    case "choice": {
      const picked = item.options.find((o) => o.id === stored?.value);
      const correctOpt = item.options.find((o) => o.correct);
      if (!picked) return { text: "(no answer)" };
      if (!correctOpt) return { text: picked.label };
      // Knowledge item: record what they chose and the point-in-time verdict.
      if (stored?.wasCorrect === false) {
        return { text: `${picked.label}  (expected: ${correctOpt.label})`, wrong: true };
      }
      return { text: `${picked.label}  (correct)` };
    }
  }
}

/**
 * Render a completed questionnaire as a self-contained PDF: header, then every
 * item visible under the branch the employee took, with their answer. Pure (no
 * I/O) so it is unit-testable; the service persists the bytes as evidence.
 */
export async function renderQuizResponsePdf(input: QuizPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);

  let page: PDFPage = doc.addPage();
  let { width, height } = page.getSize();
  let y = height - PAGE_MARGIN;
  const maxWidth = width - PAGE_MARGIN * 2;

  const newPage = () => {
    page = doc.addPage();
    ({ width, height } = page.getSize());
    y = height - PAGE_MARGIN;
  };

  const draw = (
    text: string,
    size: number,
    f: PDFFont,
    color = rgb(0, 0, 0),
  ) => {
    for (const line of wrapText(text, f, size, maxWidth)) {
      if (y - size < PAGE_MARGIN) newPage();
      page.drawText(line, { x: PAGE_MARGIN, y, size, font: f, color });
      y -= size + LINE_GAP;
    }
  };

  // ── Header ──
  draw(safe(input.trainingTitle), TITLE_SIZE, bold);
  y -= LINE_GAP;
  draw(
    `${safe(input.employeeName)}  |  ${safe(input.revisionLabel)}  |  Completed ${input.completedAt.toLocaleDateString()}`,
    META_SIZE,
    font,
    MUTED,
  );
  draw(
    "Retained as a record of the completed IT induction questionnaire.",
    META_SIZE,
    italic,
    MUTED,
  );
  y -= BLOCK_GAP;

  let lastSection: string | null = null;
  for (const { sectionId, item } of visibleItems(input.document, input.answers)) {
    const answer = describeAnswer(item, input.answers[item.id]);
    if (!answer) continue; // info items carry no answer

    const section = input.document.sections.find((s) => s.id === sectionId);
    if (section && sectionId !== lastSection) {
      y -= BLOCK_GAP;
      draw(safe(section.title), SECTION_SIZE, bold, MUTED);
      y -= LINE_GAP;
      lastSection = sectionId;
    }

    draw(safe(item.prompt), PROMPT_SIZE, bold);
    draw(answer.text, ANSWER_SIZE, font, answer.wrong ? WRONG : rgb(0.1, 0.1, 0.1));
    y -= BLOCK_GAP;
  }

  return doc.save();
}
